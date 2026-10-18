const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { uploadReturnProof, uploadPaymentSlip, uploadExtendSlip, useCloudinary } = require('../middleware/upload');
const { calcDueDate, calcShippingFee, calcDeposit, calcExtendFee } = require('../utils/calcBorrow');
const { sendMail, returnRequestedTemplate } = require('../utils/mailer');

const router = express.Router();

// ------------------------------------------------------------
// ดูตัวอย่างค่าใช้จ่าย/กำหนดวันคืน ก่อนยืนยันยืม (preview)
// ใช้ในหน้า Borrow เพื่อโชว์ค่าจัดส่ง + ค่ามัดจำ + วันครบกำหนดคืน แบบเรียลไทม์
// ------------------------------------------------------------
router.get('/quote', requireAuth, async (req, res) => {
  try {
    const { book_id, shipping_company_id } = req.query;
    const [[book]] = await pool.query(
      `SELECT b.*, bt.borrow_days, bt.deposit_amount AS type_deposit
       FROM books b JOIN book_types bt ON b.book_type_id = bt.id WHERE b.id = ?`, [book_id]);
    const [[shipping]] = await pool.query('SELECT * FROM shipping_companies WHERE id = ?', [shipping_company_id]);
    if (!book || !shipping) return res.status(404).json({ message: 'ไม่พบข้อมูลหนังสือหรือบริษัทขนส่ง' });

    const shipping_fee = calcShippingFee(shipping, 1);
    const deposit_amount = calcDeposit({ deposit_amount: book.type_deposit }, book);
    const borrow_date = new Date().toISOString().slice(0, 10);
    const due_date = calcDueDate(borrow_date, book.borrow_days, shipping.delivery_days);

    res.json({ shipping_fee, deposit_amount, borrow_date, due_date, borrow_days: book.borrow_days,
      delivery_days: shipping.delivery_days, total_pay: Number(shipping_fee) + Number(deposit_amount) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'คำนวณข้อมูลไม่สำเร็จ' });
  }
});

// ------------------------------------------------------------
// สร้างรายการยืมหนังสือใหม่ (ลูกค้า) — สร้างเป็นสถานะรอชำระเงินก่อนเสมอ
// (payment_status = 'pending' จนกว่าจะแนบสลิปและแอดมินยืนยัน)
// ------------------------------------------------------------
router.post('/', requireAuth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { book_id, shipping_company_id, shipping_address } = req.body;
    if (!shipping_address || !shipping_address.trim()) {
      return res.status(400).json({ message: 'กรุณากรอกที่อยู่สำหรับจัดส่งหนังสือ' });
    }
    await conn.beginTransaction();

    const [[book]] = await conn.query(
      `SELECT b.*, bt.borrow_days, bt.deposit_amount AS type_deposit
       FROM books b JOIN book_types bt ON b.book_type_id = bt.id WHERE b.id = ? FOR UPDATE`, [book_id]);
    if (!book) { await conn.rollback(); return res.status(404).json({ message: 'ไม่พบหนังสือ' }); }
    if (book.available_copies < 1) {
      await conn.rollback();
      return res.status(400).json({ message: 'หนังสือเล่มนี้ถูกยืมหมดแล้ว' });
    }
    const [[shipping]] = await conn.query('SELECT * FROM shipping_companies WHERE id = ? AND is_active = 1', [shipping_company_id]);
    if (!shipping) { await conn.rollback(); return res.status(404).json({ message: 'ไม่พบบริษัทขนส่งที่เลือก' }); }

    const shipping_fee = calcShippingFee(shipping, 1);
    const deposit_amount = calcDeposit({ deposit_amount: book.type_deposit }, book);
    const borrow_date = new Date().toISOString().slice(0, 10);
    const due_date = calcDueDate(borrow_date, book.borrow_days, shipping.delivery_days);

    const [result] = await conn.query(
      `INSERT INTO borrow_records
       (user_id, book_id, shipping_company_id, shipping_address, shipping_fee, deposit_amount, borrow_date, due_date, status, payment_status, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_shipment', 'pending', 'promptpay')`,
      [req.user.id, book_id, shipping_company_id, shipping_address.trim(), shipping_fee, deposit_amount, borrow_date, due_date]
    );
    await conn.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?', [book_id]);
    await conn.commit();

    res.status(201).json({
      id: result.insertId, shipping_fee, deposit_amount, borrow_date, due_date,
      message: 'สร้างรายการยืมสำเร็จ กรุณาชำระเงินและแนบสลิป'
    });
  } catch (err) {
    await conn.rollback();
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
    `SELECT br.*, b.title, b.cover_image, b.book_type_id, sc.name AS shipping_company_name, sc.tracking_url
     FROM borrow_records br
     JOIN books b ON br.book_id = b.id
     JOIN shipping_companies sc ON br.shipping_company_id = sc.id
     WHERE br.user_id = ? ORDER BY br.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

// ------------------------------------------------------------
// ดูรายละเอียดรายการยืมรายการเดียว (ใช้ในหน้าชำระเงิน / คืนหนังสือ / ขอต่ออายุยืม / ติดตามพัสดุ)
// ------------------------------------------------------------
router.get('/:id', requireAuth, async (req, res) => {
  const [[record]] = await pool.query(
    `SELECT br.*, b.title, b.cover_image, b.author, sc.name AS shipping_company_name, sc.tracking_url
     FROM borrow_records br
     JOIN books b ON br.book_id = b.id
     JOIN shipping_companies sc ON br.shipping_company_id = sc.id
     WHERE br.id = ? AND br.user_id = ?`, [req.params.id, req.user.id]);
  if (!record) return res.status(404).json({ message: 'ไม่พบรายการยืมนี้' });
  res.json(record);
});

// ------------------------------------------------------------
// ยอดที่ต้องชำระของรายการยืมที่สร้างไว้แล้ว (ใช้คู่กับ QR PromptPay แบบรูปคงที่ฝั่ง frontend)
// (ใช้ยอดจริงที่บันทึกไว้ตอนสร้างรายการ ไม่ต้องคำนวณใหม่)
// ------------------------------------------------------------
router.get('/:id/payment-qr', requireAuth, async (req, res) => {
  try {
    const [[record]] = await pool.query(
      'SELECT * FROM borrow_records WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!record) return res.status(404).json({ message: 'ไม่พบรายการยืมนี้' });

    const amount = Number(record.shipping_fee) + Number(record.deposit_amount);
    res.json({ amount, shipping_fee: record.shipping_fee, deposit_amount: record.deposit_amount });
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

    const [[record]] = await pool.query(
      'SELECT * FROM borrow_records WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!record) return res.status(404).json({ message: 'ไม่พบรายการยืมนี้' });
    if (record.payment_status === 'paid') {
      return res.status(400).json({ message: 'รายการนี้ชำระเงินเรียบร้อยแล้ว' });
    }

    const imagePath = useCloudinary ? req.file.path : `/uploads/payment-slips/${req.file.filename}`;
    await pool.query(
      `UPDATE borrow_records SET payment_slip_image = ?, payment_status = 'pending_verification' WHERE id = ?`,
      [imagePath, req.params.id]
    );
    res.json({ message: 'แนบสลิปสำเร็จ รอเจ้าหน้าที่ตรวจสอบการชำระเงิน', slip_image: imagePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถแนบสลิปได้' });
  }
});

// ------------------------------------------------------------
// ขอต่ออายุยืม (ยืดเวลาคืน) — ต้องชำระค่าธรรมเนียมต่ออายุก่อน (ดู extend-payment-qr / extend-payment-slip)
// แล้วรอแอดมินตรวจสอบสลิปจึงจะมีผลกับกำหนดคืนจริง
// ------------------------------------------------------------
router.post('/:id/extend-request', requireAuth, async (req, res) => {
  try {
    const { extra_days } = req.body;
    const days = Number(extra_days) || 7;
    const [[record]] = await pool.query(
      'SELECT * FROM borrow_records WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!record) return res.status(404).json({ message: 'ไม่พบรายการยืมนี้' });
    if (record.status !== 'borrowing') {
      return res.status(400).json({ message: 'ขอต่ออายุยืมได้เฉพาะรายการที่กำลังยืมอยู่เท่านั้น' });
    }
    if (record.extend_status === 'pending') {
      return res.status(400).json({ message: 'มีคำขอต่ออายุยืมที่รอดำเนินการอยู่แล้ว' });
    }
    const extend_fee = calcExtendFee(days);
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
    if (!record) return res.status(404).json({ message: 'ไม่พบรายการยืมนี้' });
    if (record.extend_status !== 'pending') {
      return res.status(400).json({ message: 'ไม่มีคำขอต่ออายุยืมที่รอชำระเงิน' });
    }

    const imagePath = useCloudinary ? req.file.path : `/uploads/extend-payment-slips/${req.file.filename}`;
    await pool.query(
      `UPDATE borrow_records SET extend_payment_slip_image = ?, extend_payment_status = 'pending_verification' WHERE id = ?`,
      [imagePath, req.params.id]
    );
    res.json({ message: 'แนบสลิปสำเร็จ รอเจ้าหน้าที่ตรวจสอบการชำระค่าธรรมเนียมต่ออายุ', slip_image: imagePath });
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

    const [[record]] = await pool.query(
      `SELECT br.*, b.title, u.full_name, u.email
       FROM borrow_records br
       JOIN books b ON br.book_id = b.id
       JOIN users u ON br.user_id = u.id
       WHERE br.id = ? AND br.user_id = ?`, [req.params.id, req.user.id]
    );
    if (!record) return res.status(404).json({ message: 'ไม่พบรายการยืมนี้' });
    if (!['borrowing', 'pending_shipment'].includes(record.status)) {
      return res.status(400).json({ message: 'รายการนี้ไม่สามารถแจ้งคืนได้' });
    }

    const imagePath = useCloudinary ? req.file.path : `/uploads/return-proofs/${req.file.filename}`;
    await pool.query(
      `UPDATE borrow_records SET return_proof_image = ?, status = 'return_requested', return_date = CURDATE() WHERE id = ?`,
      [imagePath, req.params.id]
    );

    sendMail(record.email, 'ได้รับแจ้งคืนหนังสือของคุณแล้ว',
      returnRequestedTemplate(record.full_name, record.title))
      .catch(err => console.error('[mailer] return-requested error:', err));

    res.json({ message: 'แจ้งคืนหนังสือสำเร็จ รอแอดมินตรวจสอบและคืนเงินมัดจำ', proof_image: imagePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถแจ้งคืนหนังสือได้' });
  }
});

module.exports = router;
