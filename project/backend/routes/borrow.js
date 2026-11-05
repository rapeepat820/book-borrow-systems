const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { uploadReturnProof, uploadPaymentSlip, uploadExtendSlip, useCloudinary } = require('../middleware/upload');
const {
  calcDueDate, calcDeposit, calcExtendFee, LATE_DAYS_SQL, attachLateInfo,
  MAX_BOOKS_PER_ORDER, splitShippingFee
} = require('../utils/calcBorrow');
const { heldCopies, effectiveAvailable, fulfillReservation } = require('../utils/reservations');
const requireVerified = require('../middleware/requireVerified');
const { ShippingError, getShippingQuote } = require('../utils/shippingRates');
const { parseRefundAccount, formatRefundAccount } = require('../utils/refundAccount');
const { sendMail, returnRequestedTemplate } = require('../utils/mailer');
const { runSlipCheck, discardFile } = require('../utils/slipVerify');

const router = express.Router();

// รายการยืมที่ต้อง "ชำระเงินด้วยกัน": ถ้าอยู่ในออเดอร์เดียวกัน = ทุกเล่มในออเดอร์ ไม่ใช่ออเดอร์ = เล่มเดียว (เฉพาะของผู้ใช้คนนี้)
async function loadPaymentGroup(recordId, userId) {
  const [[record]] = await pool.query('SELECT * FROM borrow_records WHERE id = ? AND user_id = ?', [recordId, userId]);
  if (!record) return null;
  const [rows] = record.order_id
    ? await pool.query(
        `SELECT br.*, b.title FROM borrow_records br JOIN books b ON br.book_id = b.id
         WHERE br.order_id = ? AND br.user_id = ? ORDER BY br.id`, [record.order_id, userId])
    : await pool.query('SELECT br.*, b.title FROM borrow_records br JOIN books b ON br.book_id = b.id WHERE br.id = ?', [record.id]);
  return rows;
}

// ------------------------------------------------------------
// ดูตัวอย่างค่าใช้จ่าย/กำหนดวันคืน ก่อนยืนยันยืม (preview)
// ใช้ในหน้า Borrow เพื่อโชว์ค่าจัดส่ง + ค่ามัดจำ + วันครบกำหนดคืน แบบเรียลไทม์
// ------------------------------------------------------------
router.get('/quote', requireAuth, async (req, res) => {
  try {
    const { shipping_company_id } = req.query;
    // รองรับยืมหลายเล่ม: book_ids=1,2,3 (หรือ book_id=1 แบบเดิม)
    const ids = [...new Set(String(req.query.book_ids || req.query.book_id || '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0))];
    if (!ids.length) return res.status(400).json({ message: 'กรุณาเลือกหนังสืออย่างน้อย 1 เล่ม' });
    if (ids.length > MAX_BOOKS_PER_ORDER) return res.status(400).json({ message: `ยืมได้สูงสุด ${MAX_BOOKS_PER_ORDER} เล่มต่อออเดอร์` });

    const [books] = await pool.query(
      `SELECT b.*, bt.borrow_days, bt.deposit_amount AS type_deposit
       FROM books b JOIN book_types bt ON b.book_type_id = bt.id WHERE b.id IN (?)`, [ids]);
    const [[shipping]] = await pool.query('SELECT * FROM shipping_companies WHERE id = ?', [shipping_company_id]);
    if (books.length !== ids.length || !shipping) return res.status(404).json({ message: 'ไม่พบข้อมูลหนังสือหรือบริษัทขนส่ง' });

    const ordered = ids.map(id => books.find(b => b.id === id));
    const [[me]] = await pool.query('SELECT postal_code FROM users WHERE id = ?', [req.user.id]);
    const sq = await getShippingQuote({ company: shipping, books: ordered, dstPostal: me && me.postal_code });
    const total_weight_g = sq.parcel_weight_g;
    const shipping_fee = sq.fee;
    const shares = splitShippingFee(shipping_fee, ordered);
    const borrow_date = new Date().toISOString().slice(0, 10);
    const items = ordered.map((b, i) => ({
      book_id: b.id, title: b.title, cover_image: b.cover_image, weight_g: b.weight_g,
      deposit_amount: calcDeposit({ deposit_amount: b.type_deposit }, b),
      shipping_fee_share: shares[i], borrow_days: b.borrow_days,
      due_date: calcDueDate(borrow_date, b.borrow_days, shipping.delivery_days)
    }));
    const deposit_amount = items.reduce((sum, it) => sum + Number(it.deposit_amount), 0);

    res.json({
      items, item_count: items.length, max_books: MAX_BOOKS_PER_ORDER,
      total_weight_g, packaging_weight_g: Number(sq.box.packaging_weight_g),
      box_name: sq.box.name, rate_source: sq.source, rate_note: sq.note,
      shipping_fee, deposit_amount, borrow_date,
      due_date: items.map(i => i.due_date).sort().pop(), // กำหนดคืนแต่ละเล่มอาจต่างกันตามประเภทหนังสือ (ดูใน items)
      borrow_days: items.length === 1 ? items[0].borrow_days : null,
      delivery_days: shipping.delivery_days,
      total_pay: Number(shipping_fee) + deposit_amount
    });
  } catch (err) {
    if (err instanceof ShippingError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: 'คำนวณข้อมูลไม่สำเร็จ' });
  }
});

// ------------------------------------------------------------
// สร้างรายการยืมหนังสือใหม่ (ลูกค้า) — ยืมได้หลายเล่มในออเดอร์เดียว (book_ids) หรือเล่มเดียว (book_id)
// สถานะรอชำระเงินก่อนเสมอ (payment_status = 'pending' จนกว่าจะแนบสลิปและตรวจผ่าน)
// ค่าส่งคิดตามน้ำหนักรวมของพัสดุ แล้วแบ่งลงแต่ละเล่มตามสัดส่วนน้ำหนัก; ค่ามัดจำแยกตามหนังสือแต่ละเล่ม
// ------------------------------------------------------------
router.post('/', requireAuth, requireVerified, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { shipping_company_id, shipping_address } = req.body;
    const rawIds = Array.isArray(req.body.book_ids) ? req.body.book_ids : [req.body.book_id];
    const ids = [...new Set(rawIds.map(Number).filter(n => Number.isInteger(n) && n > 0))];
    if (!shipping_address || !shipping_address.trim()) {
      return res.status(400).json({ message: 'กรุณากรอกที่อยู่สำหรับจัดส่งหนังสือ' });
    }
    if (!ids.length) return res.status(400).json({ message: 'กรุณาเลือกหนังสืออย่างน้อย 1 เล่ม' });
    if (ids.length > MAX_BOOKS_PER_ORDER) {
      return res.status(400).json({ message: `ยืมได้สูงสุด ${MAX_BOOKS_PER_ORDER} เล่มต่อออเดอร์` });
    }
    // คำนวณค่าส่งก่อนเริ่มทรานแซกชัน (อาจเรียก API ขนส่ง ไม่ควรถือล็อกแถวหนังสือไว้ระหว่างรอ)
    const [pre] = await pool.query('SELECT b.* FROM books b WHERE b.id IN (?)', [ids]);
    const [[preShip]] = await pool.query('SELECT * FROM shipping_companies WHERE id = ? AND is_active = 1', [shipping_company_id]);
    if (pre.length !== ids.length) return res.status(404).json({ message: 'ไม่พบหนังสือ' });
    if (!preShip) return res.status(404).json({ message: 'ไม่พบบริษัทขนส่งที่เลือก' });
    const [[me]] = await pool.query('SELECT postal_code FROM users WHERE id = ?', [req.user.id]);
    const sq = await getShippingQuote({ company: preShip, books: ids.map(id => pre.find(b => b.id === id)), dstPostal: me && me.postal_code });

    await conn.beginTransaction();

    // ล็อกหนังสือเรียงตาม id เสมอ กัน deadlock เมื่อหลายคนยืมพร้อมกัน
    const books = [];
    for (const id of [...ids].sort((a, b) => a - b)) {
      const [[book]] = await conn.query(
        `SELECT b.*, bt.borrow_days, bt.deposit_amount AS type_deposit
         FROM books b JOIN book_types bt ON b.book_type_id = bt.id WHERE b.id = ? FOR UPDATE`, [id]);
      if (!book) { await conn.rollback(); return res.status(404).json({ message: 'ไม่พบหนังสือ' }); }
      // เล่มว่างที่เรายืมได้จริง = เล่มว่าง - เล่มที่กันไว้ให้ผู้จองคิวคนอื่น
      if (await effectiveAvailable(conn, book, req.user.id) < 1) {
        await conn.rollback();
        return res.status(400).json({ message: `"${book.title}" ถูกยืมหมดแล้ว (จองคิวได้ที่หน้าหนังสือ)` });
      }
      books.push(book);
    }
    const ordered = ids.map(id => books.find(b => b.id === id));

    const [[shipping]] = await conn.query('SELECT * FROM shipping_companies WHERE id = ? AND is_active = 1', [shipping_company_id]);
    if (!shipping) { await conn.rollback(); return res.status(404).json({ message: 'ไม่พบบริษัทขนส่งที่เลือก' }); }

    const total_weight_g = sq.parcel_weight_g;
    const shipping_fee_total = sq.fee;
    const shares = splitShippingFee(shipping_fee_total, ordered);
    const borrow_date = new Date().toISOString().slice(0, 10);

    let orderId = null;
    if (ordered.length > 1) {
      const [o] = await conn.query(
        'INSERT INTO borrow_orders (user_id, shipping_company_id, item_count, total_weight_g, shipping_fee) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, shipping_company_id, ordered.length, total_weight_g, shipping_fee_total]);
      orderId = o.insertId;
    }

    const recordIds = [];
    let deposit_total = 0;
    let due_date = borrow_date;
    for (let i = 0; i < ordered.length; i++) {
      const book = ordered[i];
      const deposit_amount = calcDeposit({ deposit_amount: book.type_deposit }, book);
      const due = calcDueDate(borrow_date, book.borrow_days, shipping.delivery_days);
      if (due > due_date) due_date = due;
      deposit_total += Number(deposit_amount);
      const [result] = await conn.query(
        `INSERT INTO borrow_records
         (user_id, book_id, shipping_company_id, shipping_address, shipping_fee, deposit_amount, borrow_date, due_date, status, payment_status, payment_method, order_id,
          box_name, parcel_weight_g, shipping_rate_source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_shipment', 'pending', 'promptpay', ?, ?, ?, ?)`,
        [req.user.id, book.id, shipping_company_id, shipping_address.trim(), shares[i], deposit_amount, borrow_date, due, orderId,
          sq.box.name, total_weight_g, sq.source]
      );
      recordIds.push(result.insertId);
      await conn.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?', [book.id]);
      await fulfillReservation(conn, req.user.id, book.id, result.insertId);
    }
    await conn.commit();

    res.status(201).json({
      id: recordIds[0], ids: recordIds, order_id: orderId, item_count: recordIds.length,
      shipping_fee: shipping_fee_total, deposit_amount: deposit_total, total_weight_g, box_name: sq.box.name, rate_source: sq.source, borrow_date, due_date,
      message: 'สร้างรายการยืมสำเร็จ กรุณาชำระเงินและแนบสลิป'
    });
  } catch (err) {
    await conn.rollback();
    if (err instanceof ShippingError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถทำรายการยืมได้' });
  } finally {
    conn.release();
  }
});

// ------------------------------------------------------------
// รายการยืมของฉัน (ลูกค้า)
// ------------------------------------------------------------
router.get('/my', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT br.*, ${LATE_DAYS_SQL}, b.title, b.cover_image, b.book_type_id, sc.name AS shipping_company_name, sc.tracking_url,
            (SELECT COUNT(*) FROM borrow_records o WHERE o.order_id = br.order_id) AS order_item_count
     FROM borrow_records br
     JOIN books b ON br.book_id = b.id
     JOIN shipping_companies sc ON br.shipping_company_id = sc.id
     WHERE br.user_id = ? ORDER BY br.created_at DESC`,
    [req.user.id]
  );
  res.json(rows.map(attachLateInfo));
});

// ------------------------------------------------------------
// ดูรายละเอียดรายการยืมรายการเดียว (ใช้ในหน้าชำระเงิน / คืนหนังสือ / ขอต่ออายุยืม / ติดตามพัสดุ)
// ------------------------------------------------------------
router.get('/:id', requireAuth, async (req, res) => {
  const [[record]] = await pool.query(
    `SELECT br.*, ${LATE_DAYS_SQL}, b.title, b.cover_image, b.author, sc.name AS shipping_company_name, sc.tracking_url,
            (SELECT COUNT(*) FROM borrow_records o WHERE o.order_id = br.order_id) AS order_item_count
     FROM borrow_records br
     JOIN books b ON br.book_id = b.id
     JOIN shipping_companies sc ON br.shipping_company_id = sc.id
     WHERE br.id = ? AND br.user_id = ?`, [req.params.id, req.user.id]);
  if (!record) return res.status(404).json({ message: 'ไม่พบรายการยืมนี้' });
  res.json(attachLateInfo(record));
});

// ------------------------------------------------------------
// ยอดที่ต้องชำระของรายการยืมที่สร้างไว้แล้ว (ใช้คู่กับ QR PromptPay แบบรูปคงที่ฝั่ง frontend)
// (ใช้ยอดจริงที่บันทึกไว้ตอนสร้างรายการ ไม่ต้องคำนวณใหม่)
// ------------------------------------------------------------
router.get('/:id/payment-qr', requireAuth, async (req, res) => {
  try {
    const group = await loadPaymentGroup(req.params.id, req.user.id);
    if (!group) return res.status(404).json({ message: 'ไม่พบรายการยืมนี้' });
    const shipping_fee = group.reduce((s, r) => s + Number(r.shipping_fee), 0);
    const deposit_amount = group.reduce((s, r) => s + Number(r.deposit_amount), 0);
    res.json({
      amount: Math.round((shipping_fee + deposit_amount) * 100) / 100, shipping_fee, deposit_amount,
      item_count: group.length, items: group.map(r => ({ id: r.id, title: r.title }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถโหลดยอดชำระเงินได้' });
  }
});

// ------------------------------------------------------------
// แนบสลิปโอนเงิน — เปลี่ยนสถานะเป็น "รอตรวจสอบ" ให้แอดมินยืนยันอีกครั้ง
// ------------------------------------------------------------
router.post('/:id/payment-slip', requireAuth, uploadPaymentSlip.single('slip_image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'กรุณาแนบรูปสลิปการโอนเงิน' });

    // ออเดอร์หลายเล่มชำระรวมกันด้วยสลิปใบเดียว: ตรวจยอดรวมทั้งออเดอร์ แล้วอัปเดตทุกเล่มพร้อมกัน
    const group = await loadPaymentGroup(req.params.id, req.user.id);
    if (!group) { await discardFile(req.file, useCloudinary); return res.status(404).json({ message: 'ไม่พบรายการยืมนี้' }); }
    const unpaid = group.filter(r => r.payment_status !== 'paid');
    if (!unpaid.length) {
      await discardFile(req.file, useCloudinary);
      return res.status(400).json({ message: 'รายการนี้ชำระเงินเรียบร้อยแล้ว' });
    }

    // อ่าน QR บนสลิป + กันสลิปซ้ำ (+ ตรวจกับธนาคารถ้าตั้งค่า SlipOK ไว้)
    const expectedAmount = Math.round(unpaid.reduce((sum, r) => sum + Number(r.shipping_fee) + Number(r.deposit_amount), 0) * 100) / 100;
    const anchor = group[0]; // ใช้เล่มแรกของออเดอร์เป็นตัวแทนในตารางกันสลิปซ้ำ
    let check;
    try {
      check = await runSlipCheck({
        file: req.file, useCloudinary, recordId: anchor.id, purpose: 'borrow',
        expectedAmount, createdAt: anchor.created_at
      });
    } catch (err) {
      // ระบบตรวจสลิปพัง (เช่น ยังไม่ได้รัน migration v7) → ใช้วิธีเดิม ส่งให้แอดมินตรวจเอง ไม่ให้ลูกค้าติดขัด
      console.error('[slip] ตรวจสลิปอัตโนมัติผิดพลาด ใช้การตรวจโดยแอดมินแทน:', err);
      check = { outcome: 'pending_manual', message: 'แนบสลิปสำเร็จ รอเจ้าหน้าที่ตรวจสอบการชำระเงิน' };
    }

    if (check.outcome === 'rejected') {
      await discardFile(req.file, useCloudinary);
      return res.status(400).json({ message: check.message });
    }

    const imagePath = useCloudinary ? req.file.path : `/uploads/payment-slips/${req.file.filename}`;
    const ids = unpaid.map(r => r.id);
    if (check.outcome === 'auto_verified') {
      await pool.query(
        `UPDATE borrow_records SET payment_slip_image = ?, payment_status = 'paid', paid_at = NOW()
         WHERE id IN (?) AND payment_status <> 'paid'`,
        [imagePath, ids]
      );
    } else {
      await pool.query(
        `UPDATE borrow_records SET payment_slip_image = ?, payment_status = 'pending_verification' WHERE id IN (?)`,
        [imagePath, ids]
      );
    }
    res.json({
      message: check.outcome === 'auto_verified' ? check.message : 'แนบสลิปสำเร็จ รอเจ้าหน้าที่ตรวจสอบการชำระเงิน',
      slip_image: imagePath,
      auto_verified: check.outcome === 'auto_verified'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถแนบสลิปได้' });
  }
});

// ------------------------------------------------------------
// ขอต่ออายุยืม (ยืดเวลาคืน) — ต้องชำระค่าธรรมเนียมต่ออายุก่อน (ดู extend-payment-qr / extend-payment-slip)
// แล้วรอแอดมินตรวจสอบสลิปจึงจะมีผลกับกำหนดคืนจริง
// ------------------------------------------------------------
// ต่ออายุได้ครั้งละเท่าระยะเวลายืมปกติของประเภทหนังสือนั้น และค่าธรรมเนียม = เท่ากับค่ามัดจำของหนังสือเล่มนั้น
async function loadExtendInfo(recordId, userId) {
  const [[record]] = await pool.query(
    `SELECT br.*, b.price_value, bt.borrow_days, bt.deposit_amount AS type_deposit
     FROM borrow_records br JOIN books b ON br.book_id = b.id JOIN book_types bt ON b.book_type_id = bt.id
     WHERE br.id = ? AND br.user_id = ?`, [recordId, userId]);
  if (!record) return null;
  const days = Number(record.borrow_days) || 7;
  const fee = calcExtendFee(calcDeposit({ deposit_amount: record.type_deposit }, record));
  return { record, days, fee };
}

router.get('/:id/extend-quote', requireAuth, async (req, res) => {
  try {
    const info = await loadExtendInfo(req.params.id, req.user.id);
    if (!info) return res.status(404).json({ message: 'ไม่พบรายการยืมนี้' });
    res.json({ extra_days: info.days, extend_fee: info.fee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'คำนวณค่าต่ออายุไม่สำเร็จ' });
  }
});

router.post('/:id/extend-request', requireAuth, async (req, res) => {
  try {
    const info = await loadExtendInfo(req.params.id, req.user.id);
    if (!info) return res.status(404).json({ message: 'ไม่พบรายการยืมนี้' });
    const { record, days, fee: extend_fee } = info;
    if (record.status !== 'borrowing') {
      return res.status(400).json({ message: 'ขอต่ออายุยืมได้เฉพาะรายการที่กำลังยืมอยู่เท่านั้น' });
    }
    if (record.extend_status === 'pending') {
      return res.status(400).json({ message: 'มีคำขอต่ออายุยืมที่รอดำเนินการอยู่แล้ว' });
    }
    await pool.query(
      `UPDATE borrow_records
       SET extend_requested_days = ?, extend_status = 'pending',
           extend_fee = ?, extend_payment_status = 'pending', extend_payment_slip_image = NULL, extend_paid_at = NULL
       WHERE id = ?`,
      [days, extend_fee, req.params.id]
    );
    res.json({
      message: 'ส่งคำขอต่ออายุยืมสำเร็จ กรุณาชำระค่าธรรมเนียมต่ออายุเพื่อยืนยัน',
      extra_days: days,
      extend_fee
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถส่งคำขอต่ออายุยืมได้' });
  }
});

// ------------------------------------------------------------
// ยอดค่าธรรมเนียมต่ออายุยืมของคำขอที่ส่งไว้แล้ว (ใช้คู่กับ QR PromptPay แบบรูปคงที่ฝั่ง frontend)
// ------------------------------------------------------------
router.get('/:id/extend-payment-qr', requireAuth, async (req, res) => {
  try {
    const [[record]] = await pool.query(
      'SELECT * FROM borrow_records WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!record) return res.status(404).json({ message: 'ไม่พบรายการยืมนี้' });
    if (record.extend_status !== 'pending' || !record.extend_fee) {
      return res.status(400).json({ message: 'ไม่มีคำขอต่ออายุยืมที่รอชำระเงิน' });
    }

    const amount = Number(record.extend_fee);
    res.json({ amount, extend_fee: record.extend_fee, extra_days: record.extend_requested_days });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถโหลดยอดชำระเงินได้' });
  }
});

// ------------------------------------------------------------
// แนบสลิปโอนเงินค่าธรรมเนียมต่ออายุยืม — เปลี่ยนสถานะเป็น "รอตรวจสอบ" ให้แอดมินยืนยันอีกครั้ง
// ------------------------------------------------------------
router.post('/:id/extend-payment-slip', requireAuth, uploadExtendSlip.single('slip_image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'กรุณาแนบรูปสลิปการโอนเงิน' });

    const [[record]] = await pool.query(
      'SELECT * FROM borrow_records WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!record) { await discardFile(req.file, useCloudinary); return res.status(404).json({ message: 'ไม่พบรายการยืมนี้' }); }
    if (record.extend_status !== 'pending') {
      await discardFile(req.file, useCloudinary);
      return res.status(400).json({ message: 'ไม่มีคำขอต่ออายุยืมที่รอชำระเงิน' });
    }

    let check;
    try {
      check = await runSlipCheck({
        file: req.file, useCloudinary, recordId: record.id, purpose: 'extend',
        expectedAmount: Number(record.extend_fee), createdAt: null
      });
    } catch (err) {
      console.error('[slip] ตรวจสลิปอัตโนมัติผิดพลาด ใช้การตรวจโดยแอดมินแทน:', err);
      check = { outcome: 'pending_manual', message: 'แนบสลิปสำเร็จ รอเจ้าหน้าที่ตรวจสอบการชำระค่าธรรมเนียมต่ออายุ' };
    }

    if (check.outcome === 'rejected') {
      await discardFile(req.file, useCloudinary);
      return res.status(400).json({ message: check.message });
    }

    const imagePath = useCloudinary ? req.file.path : `/uploads/extend-payment-slips/${req.file.filename}`;
    if (check.outcome === 'auto_verified') {
      // อนุมัติต่ออายุให้อัตโนมัติ — ทำเหมือนที่แอดมินกดยืนยัน (บวกวันเข้ากำหนดคืนทันที)
      await pool.query(
        `UPDATE borrow_records
         SET extend_payment_slip_image = ?, due_date = DATE_ADD(due_date, INTERVAL ? DAY),
             extend_status = 'approved', extend_payment_status = 'paid', extend_paid_at = NOW()
         WHERE id = ? AND extend_status = 'pending'`,
        [imagePath, record.extend_requested_days, req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE borrow_records SET extend_payment_slip_image = ?, extend_payment_status = 'pending_verification' WHERE id = ?`,
        [imagePath, req.params.id]
      );
    }
    res.json({
      message: check.outcome === 'auto_verified' ? 'ตรวจสอบสลิปสำเร็จ ต่ออายุยืมเรียบร้อยแล้ว'
        : 'แนบสลิปสำเร็จ รอเจ้าหน้าที่ตรวจสอบการชำระค่าธรรมเนียมต่ออายุ',
      slip_image: imagePath,
      auto_verified: check.outcome === 'auto_verified'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถแนบสลิปได้' });
  }
});

// ------------------------------------------------------------
// แจ้งคืนหนังสือ พร้อมแนบหลักฐานภาพถ่าย (ลูกค้า)
// (ข้อ 3: ต้องแนบหลักฐานการคืน)
// ------------------------------------------------------------
router.post('/:id/return', requireAuth, uploadReturnProof.single('proof_image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'กรุณาแนบรูปภาพหลักฐานการคืนหนังสือ' });
    const fail = async (status, message) => { await discardFile(req.file, useCloudinary); return res.status(status).json({ message }); };

    const [[record]] = await pool.query(
      `SELECT br.*, b.title, u.full_name, u.email
       FROM borrow_records br
       JOIN books b ON br.book_id = b.id
       JOIN users u ON br.user_id = u.id
       WHERE br.id = ? AND br.user_id = ?`, [req.params.id, req.user.id]
    );
    if (!record) return fail(404, 'ไม่พบรายการยืมนี้');
    if (!['borrowing', 'pending_shipment'].includes(record.status)) {
      return fail(400, 'รายการนี้ไม่สามารถแจ้งคืนได้');
    }

    // ต้องระบุบัญชีรับเงินมัดจำคืน (เก็บสำเนาไว้กับรายการนี้ กันโปรไฟล์ถูกแก้ภายหลัง)
    const parsed = parseRefundAccount(req.body);
    if (!parsed.ok) return fail(400, parsed.message);
    const refund = parsed.data;

    const imagePath = useCloudinary ? req.file.path : `/uploads/return-proofs/${req.file.filename}`;
    await pool.query(
      `UPDATE borrow_records
       SET return_proof_image = ?, status = 'return_requested', return_date = CURDATE(), refund_account_info = ?
       WHERE id = ?`,
      [imagePath, formatRefundAccount(refund), req.params.id]
    );
    // จำบัญชีนี้ไว้ในโปรไฟล์ ครั้งหน้าจะเติมให้อัตโนมัติ
    await pool.query(
      'UPDATE users SET refund_method = ?, refund_bank = ?, refund_account_no = ?, refund_account_name = ? WHERE id = ?',
      [refund.refund_method, refund.refund_bank, refund.refund_account_no, refund.refund_account_name, req.user.id]
    ).catch(err => console.error('[return] บันทึกบัญชีรับเงินคืนลงโปรไฟล์ไม่สำเร็จ:', err.message));

    sendMail(record.email, 'ได้รับแจ้งคืนหนังสือของคุณแล้ว',
      returnRequestedTemplate(record.full_name, record.title))
      .catch(err => console.error('[mailer] return-requested error:', err));

    res.json({ message: 'แจ้งคืนหนังสือสำเร็จ รอแอดมินตรวจสอบและโอนเงินมัดจำคืน', proof_image: imagePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถแจ้งคืนหนังสือได้' });
  }
});

module.exports = router;
