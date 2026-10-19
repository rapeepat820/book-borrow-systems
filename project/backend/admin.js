const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadBookCover, useCloudinary } = require('../middleware/upload');
const { lookupBook } = require('../utils/bookLookup');
const { runAutoSetup, getStatus: autoFillStatus } = require('../utils/bookAutoSetup');
const { sendMail, dueDateReminderTemplate, shippedTemplate, returnConfirmedTemplate, refundSentTemplate } = require('../utils/mailer');
const { calcDueDate, calcShippingFee, calcDeposit, calcLateFee, LATE_DAYS_SQL, LATE_FEE_GRACE_DAYS, attachLateInfo } = require('../utils/calcBorrow');
const { sendDueReminders, sendOverdueNotices } = require('../utils/reminderCron');

const router = express.Router();
router.use(requireAuth, requireAdmin); // ทุก endpoint ในไฟล์นี้ต้องเป็นแอดมิน

// ================= Dashboard =================
router.get('/dashboard', async (req, res) => {
  const [[{ totalBooks }]] = await pool.query('SELECT COUNT(*) AS totalBooks FROM books');
  const [[{ totalMembers }]] = await pool.query("SELECT COUNT(*) AS totalMembers FROM users WHERE role='customer'");
  const [[{ activeBorrows }]] = await pool.query(
    "SELECT COUNT(*) AS activeBorrows FROM borrow_records WHERE status IN ('pending_shipment','borrowing')");
  const [[{ overdueCount }]] = await pool.query(
    "SELECT COUNT(*) AS overdueCount FROM borrow_records WHERE status='borrowing' AND due_date < CURDATE()");
  // รายการที่ต้องให้แอดมินตรวจสลิป (ทั้งค่ายืมตอนแรก และค่าธรรมเนียมต่ออายุ) — เพิ่มเข้ามาให้เห็นในหน้า Dashboard ทันที
  const [[{ pendingPaymentVerification }]] = await pool.query(
    "SELECT COUNT(*) AS pendingPaymentVerification FROM borrow_records WHERE payment_status = 'pending_verification'");
  const [[{ pendingExtendVerification }]] = await pool.query(
    "SELECT COUNT(*) AS pendingExtendVerification FROM borrow_records WHERE extend_payment_status = 'pending_verification'");
  const [[{ pendingReturnCheck }]] = await pool.query(
    "SELECT COUNT(*) AS pendingReturnCheck FROM borrow_records WHERE status = 'return_requested'");
  // รายการที่คืนหนังสือแล้ว แต่ยังไม่ได้โอนเงินมัดจำคืนให้ลูกค้า
  const [[{ pendingRefunds }]] = await pool.query(
    "SELECT COUNT(*) AS pendingRefunds FROM borrow_records WHERE refund_status = 'pending'");
  res.json({
    totalBooks, totalMembers, activeBorrows, overdueCount,
    pendingPaymentVerification, pendingExtendVerification, pendingReturnCheck, pendingRefunds
  });
});

// สั่งส่งอีเมลแจ้งเตือนใกล้ครบกำหนดคืนทันที (ปกติรันอัตโนมัติทุกวัน 08:00 น. — ปุ่มนี้มีไว้ให้ทดสอบได้ทันทีโดยไม่ต้องรอ)
router.post('/send-due-reminders', async (req, res) => {
  try {
    const sent = await sendDueReminders();
    res.json({ message: `ส่งอีเมลแจ้งเตือนแล้ว ${sent} รายการ`, sent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถส่งอีเมลแจ้งเตือนได้' });
  }
});

// สั่งส่งอีเมลเตือน "เกินกำหนดคืนแล้ว" ทันที (ปกติรันอัตโนมัติทุกวัน 08:05 น. และไม่ส่งซ้ำภายใน 3 วัน)
router.post('/send-overdue-reminders', async (req, res) => {
  try {
    const sent = await sendOverdueNotices();
    res.json({ message: `ส่งอีเมลเตือนเกินกำหนดแล้ว ${sent} รายการ`, sent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถส่งอีเมลเตือนเกินกำหนดได้' });
  }
});

// ================= Books CRUD =================
router.get('/books', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT b.*, bt.type_name FROM books b JOIN book_types bt ON b.book_type_id = bt.id ORDER BY b.id DESC`);
  res.json(rows);
});

// ค้นข้อมูลหนังสือจากอินเทอร์เน็ต (Open Library + Google Books) ให้แอดมินกดดึงมาใส่ฟอร์มอัตโนมัติ
// ต้องวางก่อน '/books/:id' เสมอ ไม่งั้น "lookup" จะถูกตีความเป็น id
router.get('/books/lookup', async (req, res) => {
  const { title, author, isbn } = req.query;
  if (!title && !isbn) return res.status(400).json({ message: 'กรุณาใส่ชื่อหนังสือหรือ ISBN' });
  try {
    const info = await lookupBook({ title, author, isbn });
    if (!info) return res.status(404).json({ message: 'ไม่พบหนังสือเล่มนี้ ลองใส่ชื่อภาษาอังกฤษหรือ ISBN' });
    res.json(info);
  } catch (err) {
    console.error(err);
    res.status(502).json({ message: 'เชื่อมต่อบริการค้นหาหนังสือไม่ได้ ลองใหม่อีกครั้ง' });
  }
});

// กดปุ่มเดียวให้ระบบเติมรูปปก/ปีที่พิมพ์/ฉบับที่/เล่มที่ ให้หนังสือทุกเล่มที่ยังว่าง (ทำเบื้องหลัง ถามความคืบหน้าได้)
router.post('/books/auto-fill', (req, res) => {
  runAutoSetup(pool).catch(err => console.error('[books] auto-fill:', err.message));
  res.json({ message: 'เริ่มเติมข้อมูลหนังสืออัตโนมัติแล้ว', ...autoFillStatus() });
});
router.get('/books/auto-fill/status', (req, res) => res.json(autoFillStatus()));

router.post('/books', async (req, res) => {
  const {
    title, author, cover_image, description, book_type_id, total_copies, price_value,
    publisher, publish_year, edition, volume, print_no
  } = req.body;
  const [result] = await pool.query(
    `INSERT INTO books (title, author, cover_image, description, book_type_id, total_copies, available_copies, price_value,
       publisher, publish_year, edition, volume, print_no)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, author, cover_image || null, description || null, book_type_id, total_copies, total_copies, price_value || 0,
      publisher || null, publish_year || null, edition || null, volume || null, print_no || null]
  );
  res.status(201).json({ id: result.insertId });
});

router.put('/books/:id', async (req, res) => {
  const {
    title, author, cover_image, description, book_type_id, total_copies, price_value,
    publisher, publish_year, edition, volume, print_no
  } = req.body;
  await pool.query(
    `UPDATE books SET title=?, author=?, cover_image=?, description=?, book_type_id=?, total_copies=?, price_value=?,
       publisher=?, publish_year=?, edition=?, volume=?, print_no=? WHERE id=?`,
    [title, author, cover_image, description, book_type_id, total_copies, price_value,
      publisher || null, publish_year || null, edition || null, volume || null, print_no || null, req.params.id]
  );
  res.json({ message: 'อัปเดตข้อมูลหนังสือสำเร็จ' });
});

router.delete('/books/:id', async (req, res) => {
  await pool.query('DELETE FROM books WHERE id = ?', [req.params.id]);
  res.json({ message: 'ลบหนังสือสำเร็จ' });
});

// อัปโหลดรูปปกหนังสือ (ถ่ายรูป/เลือกไฟล์จากเครื่อง) ใช้ตอนเพิ่ม/แก้ไขหนังสือในหน้าแอดมิน
// คืนค่า URL ของรูปที่อัปโหลดแล้ว ให้ไปใส่ในฟิลด์ cover_image ตอนบันทึกฟอร์ม
router.post('/books/upload-cover', uploadBookCover.single('cover_image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'กรุณาแนบรูปปกหนังสือ' });
  const imagePath = useCloudinary ? req.file.path : `/uploads/book-covers/${req.file.filename}`;
  res.json({ message: 'อัปโหลดรูปปกสำเร็จ', cover_image: imagePath });
});

// ================= Book Types (กำหนดวันยืม + ค่ามัดจำต่อประเภท) =================
// รวมจำนวนหนังสือในแต่ละประเภทมาด้วย ให้แอดมินเห็นก่อนตัดสินใจแก้ไข/ลบ
router.get('/book-types', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT bt.*, COUNT(b.id) AS book_count
     FROM book_types bt
     LEFT JOIN books b ON b.book_type_id = bt.id
     GROUP BY bt.id
     ORDER BY bt.id`);
  res.json(rows);
});

router.post('/book-types', async (req, res) => {
  const { type_name, borrow_days, deposit_amount } = req.body;
  if (!type_name || !type_name.trim()) {
    return res.status(400).json({ message: 'กรุณากรอกชื่อประเภทหนังสือ' });
  }
  const [[dup]] = await pool.query('SELECT id FROM book_types WHERE type_name = ?', [type_name.trim()]);
  if (dup) return res.status(409).json({ message: 'มีประเภทหนังสือชื่อนี้อยู่แล้ว' });

  const [result] = await pool.query(
    'INSERT INTO book_types (type_name, borrow_days, deposit_amount) VALUES (?, ?, ?)',
    [type_name.trim(), borrow_days, deposit_amount]
  );
  res.status(201).json({ id: result.insertId });
});

router.put('/book-types/:id', async (req, res) => {
  const { type_name, borrow_days, deposit_amount } = req.body;
  if (!type_name || !type_name.trim()) {
    return res.status(400).json({ message: 'กรุณากรอกชื่อประเภทหนังสือ' });
  }
  const [[dup]] = await pool.query(
    'SELECT id FROM book_types WHERE type_name = ? AND id != ?', [type_name.trim(), req.params.id]);
  if (dup) return res.status(409).json({ message: 'มีประเภทหนังสือชื่อนี้อยู่แล้ว' });

  await pool.query('UPDATE book_types SET type_name=?, borrow_days=?, deposit_amount=? WHERE id=?',
    [type_name.trim(), borrow_days, deposit_amount, req.params.id]);
  res.json({ message: 'อัปเดตประเภทหนังสือสำเร็จ' });
});

// ลบประเภทหนังสือ — ลบไม่ได้ถ้ายังมีหนังสืออยู่ในประเภทนี้ (กันข้อมูลหนังสือค้างอยู่แบบไม่มีประเภท)
router.delete('/book-types/:id', async (req, res) => {
  const [[{ bookCount }]] = await pool.query(
    'SELECT COUNT(*) AS bookCount FROM books WHERE book_type_id = ?', [req.params.id]);
  if (bookCount > 0) {
    return res.status(400).json({
      message: `ลบไม่ได้ เพราะยังมีหนังสือ ${bookCount} เล่มอยู่ในประเภทนี้ กรุณาย้ายหรือลบหนังสือเหล่านั้นก่อน`
    });
  }
  await pool.query('DELETE FROM book_types WHERE id = ?', [req.params.id]);
  res.json({ message: 'ลบประเภทหนังสือสำเร็จ' });
});

// ================= Shipping Companies (ต้นแบบคำนวณค่าส่ง) =================
// ระบบใช้บริษัทขนส่งเพียงบริษัทเดียวเป็นค่าเริ่มต้นในการยืมของลูกค้า (is_active=1 ได้แค่แถวเดียวเสมอ)
// แอดมินยังเพิ่ม/แก้ไขบริษัทสำรองไว้ในระบบได้หลายบริษัท แต่ต้องกด "ตั้งเป็นบริษัทที่ใช้งาน" เพื่อสลับ
router.get('/shipping-companies', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM shipping_companies ORDER BY id');
  res.json(rows);
});

router.post('/shipping-companies', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { name, base_fee, fee_per_book, delivery_days, tracking_url, is_active } = req.body;
    await conn.beginTransaction();
    const wantActive = !!is_active;
    if (wantActive) {
      await conn.query('UPDATE shipping_companies SET is_active = 0');
    }
    const [result] = await conn.query(
      'INSERT INTO shipping_companies (name, base_fee, fee_per_book, delivery_days, tracking_url, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [name, base_fee, fee_per_book, delivery_days, tracking_url || null, wantActive ? 1 : 0]
    );
    await conn.commit();
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถเพิ่มบริษัทขนส่งได้' });
  } finally {
    conn.release();
  }
});

router.put('/shipping-companies/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { name, base_fee, fee_per_book, delivery_days, tracking_url, is_active } = req.body;
    await conn.beginTransaction();
    const wantActive = !!is_active;
    if (wantActive) {
      await conn.query('UPDATE shipping_companies SET is_active = 0 WHERE id <> ?', [req.params.id]);
    }
    await conn.query(
      'UPDATE shipping_companies SET name=?, base_fee=?, fee_per_book=?, delivery_days=?, tracking_url=?, is_active=? WHERE id=?',
      [name, base_fee, fee_per_book, delivery_days, tracking_url || null, wantActive ? 1 : 0, req.params.id]
    );
    await conn.commit();
    res.json({ message: 'อัปเดตข้อมูลบริษัทขนส่งสำเร็จ' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถอัปเดตบริษัทขนส่งได้' });
  } finally {
    conn.release();
  }
});

// ตั้งบริษัทนี้เป็น "บริษัทขนส่งที่ใช้งาน" เพียงบริษัทเดียว — ปิดบริษัทอื่นทั้งหมดโดยอัตโนมัติ
router.put('/shipping-companies/:id/activate', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[company]] = await conn.query('SELECT id FROM shipping_companies WHERE id = ?', [req.params.id]);
    if (!company) { await conn.rollback(); return res.status(404).json({ message: 'ไม่พบบริษัทขนส่ง' }); }
    await conn.query('UPDATE shipping_companies SET is_active = 0');
    await conn.query('UPDATE shipping_companies SET is_active = 1 WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ message: 'ตั้งเป็นบริษัทขนส่งที่ใช้งานสำเร็จ' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถตั้งบริษัทขนส่งที่ใช้งานได้' });
  } finally {
    conn.release();
  }
});

// ================= Members =================
router.get('/members', async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, full_name, email, phone, address, created_at FROM users WHERE role='customer' ORDER BY id DESC");
  res.json(rows);
});

// แอดมินเพิ่มลูกค้าใหม่ (เช่น ลูกค้าที่สมัครหน้าร้าน)
router.post('/members', async (req, res) => {
  const { full_name, email, phone, address } = req.body;
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) return res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
  const tempPassword = Math.random().toString(36).slice(-8);
  const hash = await bcrypt.hash(tempPassword, 10);
  const [result] = await pool.query(
    'INSERT INTO users (full_name, email, password_hash, phone, address, role) VALUES (?, ?, ?, ?, ?, "customer")',
    [full_name, email, hash, phone || null, address || null]
  );
  res.status(201).json({ id: result.insertId, temp_password: tempPassword,
    message: 'เพิ่มลูกค้าสำเร็จ (รหัสผ่านชั่วคราวถูกสร้างให้แล้ว แนะนำให้ลูกค้ากด "ลืมรหัสผ่าน" เพื่อตั้งรหัสใหม่)' });
});

// ================= Borrow Records Management =================
router.get('/borrow-records', async (req, res) => {
  const { status } = req.query;
  let sql = `SELECT br.*, ${LATE_DAYS_SQL}, b.title, u.full_name, u.email, sc.name AS shipping_company_name
             FROM borrow_records br
             JOIN books b ON br.book_id = b.id
             JOIN users u ON br.user_id = u.id
             JOIN shipping_companies sc ON br.shipping_company_id = sc.id`;
  const params = [];
  if (status === 'overdue') {
    // "เกินกำหนดคืน" คำนวณจากวันที่ (ไม่ได้เก็บเป็นสถานะในฐานข้อมูล): กำลังยืมอยู่และเลยกำหนดแล้ว
    sql += " WHERE br.status = 'borrowing' AND br.due_date < CURDATE()";
  } else if (status === 'refund_pending') {
    sql += " WHERE br.refund_status = 'pending'";
  } else if (status) {
    sql += ' WHERE br.status = ?'; params.push(status);
  }
  sql += ' ORDER BY br.created_at DESC';
  const [rows] = await pool.query(sql, params);
  res.json(rows.map(attachLateInfo));
});

// แอดมินสร้างรายการยืมใหม่ให้ลูกค้า (กรณีลูกค้าโทร/มาที่ร้านโดยตรง)
router.post('/borrow-records', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { user_id, book_id, shipping_company_id, shipping_address } = req.body;
    await conn.beginTransaction();
    const [[book]] = await conn.query(
      `SELECT b.*, bt.borrow_days, bt.deposit_amount AS type_deposit
       FROM books b JOIN book_types bt ON b.book_type_id = bt.id WHERE b.id = ? FOR UPDATE`, [book_id]);
    if (!book || book.available_copies < 1) {
      await conn.rollback();
      return res.status(400).json({ message: 'หนังสือเล่มนี้ไม่พร้อมให้ยืม' });
    }
    const [[shipping]] = await conn.query('SELECT * FROM shipping_companies WHERE id = ?', [shipping_company_id]);
    if (!shipping) { await conn.rollback(); return res.status(404).json({ message: 'ไม่พบบริษัทขนส่ง' }); }

    let address = (shipping_address || '').trim();
    if (!address) {
      const [[member]] = await conn.query('SELECT address FROM users WHERE id = ?', [user_id]);
      address = member?.address || '';
    }
    if (!address) {
      await conn.rollback();
      return res.status(400).json({ message: 'กรุณาระบุที่อยู่จัดส่ง (ลูกค้ารายนี้ยังไม่มีที่อยู่ในโปรไฟล์)' });
    }

    const shipping_fee = calcShippingFee(shipping, 1);
    const deposit_amount = calcDeposit({ deposit_amount: book.type_deposit }, book);
    const borrow_date = new Date().toISOString().slice(0, 10);
    const due_date = calcDueDate(borrow_date, book.borrow_days, shipping.delivery_days);

    const [result] = await conn.query(
      `INSERT INTO borrow_records (user_id, book_id, shipping_company_id, shipping_address, shipping_fee, deposit_amount, borrow_date, due_date, status, payment_status, payment_method, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_shipment', 'paid', 'cash', NOW())`,
      [user_id, book_id, shipping_company_id, address, shipping_fee, deposit_amount, borrow_date, due_date]
    );
    await conn.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?', [book_id]);
    await conn.commit();
    res.status(201).json({ id: result.insertId, message: 'เพิ่มรายการยืมสำเร็จ' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถเพิ่มรายการยืมได้' });
  } finally {
    conn.release();
  }
});

// แอดมินอัปเดตสถานะกระบวนการจัดส่ง (ข้อ: ให้ผู้ยืมติดตามได้ว่าพัสดุถึงขั้นตอนไหนแล้ว)
// ลำดับ: preparing (กำลังแพ็คสินค้า) -> shipped (กำลังจัดส่ง) -> out_for_delivery (ขนส่งกำลังนำส่ง) -> delivered (จัดส่งถึงแล้ว)
// ต้องกรอกเลข tracking ตั้งแต่ขั้น shipped เป็นต้นไป (ข้อ 2: จัดเก็บ tracking no.)
const SHIPPING_STAGES = ['preparing', 'shipped', 'out_for_delivery', 'delivered'];

router.put('/borrow-records/:id/shipping-status', async (req, res) => {
  const { shipping_status, tracking_no } = req.body;
  if (!SHIPPING_STAGES.includes(shipping_status)) {
    return res.status(400).json({ message: 'สถานะจัดส่งไม่ถูกต้อง' });
  }
  const [[record]] = await pool.query('SELECT * FROM borrow_records WHERE id = ?', [req.params.id]);
  if (!record) return res.status(404).json({ message: 'ไม่พบรายการ' });

  const needsTracking = SHIPPING_STAGES.indexOf(shipping_status) >= SHIPPING_STAGES.indexOf('shipped');
  const finalTrackingNo = tracking_no || record.tracking_no;
  if (needsTracking && !finalTrackingNo) {
    return res.status(400).json({ message: 'กรุณาระบุเลข tracking ก่อนเปลี่ยนเป็นสถานะนี้' });
  }

  // เมื่อเริ่มจัดส่งจริง (shipped ขึ้นไป) ให้ปรับสถานะหลักของรายการเป็น "กำลังยืม" ด้วย
  const newMainStatus = SHIPPING_STAGES.indexOf(shipping_status) >= SHIPPING_STAGES.indexOf('shipped') && record.status === 'pending_shipment'
    ? 'borrowing' : record.status;

  await pool.query(
    `UPDATE borrow_records SET shipping_status = ?, tracking_no = ?, status = ? WHERE id = ?`,
    [shipping_status, finalTrackingNo || null, newMainStatus, req.params.id]
  );

  if (shipping_status === 'shipped') {
    const [[full]] = await pool.query(
      `SELECT br.*, b.title, u.full_name, u.email FROM borrow_records br
       JOIN books b ON br.book_id=b.id JOIN users u ON br.user_id=u.id WHERE br.id=?`, [req.params.id]);
    if (full) {
      sendMail(full.email, 'พัสดุหนังสือของคุณถูกจัดส่งแล้ว',
        shippedTemplate(full.full_name, full.title, full.due_date, finalTrackingNo))
        .catch(err => console.error('[mailer] shipped-notification error:', err));
    }
  }

  res.json({ message: 'อัปเดตสถานะจัดส่งสำเร็จ' });
});

// แอดมินตรวจสอบสลิปโอนเงินที่ลูกค้าแนบ แล้วยืนยัน/ปฏิเสธการชำระเงิน
router.put('/borrow-records/:id/verify-payment', async (req, res) => {
  const { approve } = req.body; // true = ยืนยันว่าชำระเงินถูกต้อง, false = ปฏิเสธสลิป (ให้ลูกค้าแนบใหม่)
  const [[record]] = await pool.query('SELECT * FROM borrow_records WHERE id = ?', [req.params.id]);
  if (!record) return res.status(404).json({ message: 'ไม่พบรายการ' });
  if (record.payment_status !== 'pending_verification') {
    return res.status(400).json({ message: 'รายการนี้ไม่มีสลิปที่รอตรวจสอบ' });
  }
  if (approve) {
    await pool.query(`UPDATE borrow_records SET payment_status = 'paid', paid_at = NOW() WHERE id = ?`, [req.params.id]);
  } else {
    await pool.query(`UPDATE borrow_records SET payment_status = 'pending', payment_slip_image = NULL WHERE id = ?`, [req.params.id]);
  }
  res.json({ message: approve ? 'ยืนยันการชำระเงินสำเร็จ' : 'ปฏิเสธสลิป ลูกค้าต้องแนบสลิปใหม่' });
});

// แอดมินปฏิเสธคำขอต่ออายุยืมของลูกค้า (ยกเลิกคำขอ ไม่ว่าจะชำระเงินแล้วหรือยังก็ตาม)
// การอนุมัติต่ออายุยืมจริงทำผ่าน /borrow-records/:id/verify-extend-payment เท่านั้น
// (ต้องให้ลูกค้าชำระค่าธรรมเนียมต่ออายุและแอดมินตรวจสอบสลิปผ่านก่อน จึงจะมีผลกับ due_date)
router.put('/borrow-records/:id/resolve-extend', async (req, res) => {
  const { approve } = req.body;
  const [[record]] = await pool.query('SELECT * FROM borrow_records WHERE id = ?', [req.params.id]);
  if (!record) return res.status(404).json({ message: 'ไม่พบรายการ' });
  if (record.extend_status !== 'pending') {
    return res.status(400).json({ message: 'รายการนี้ไม่มีคำขอต่ออายุยืมที่รออนุมัติ' });
  }
  if (approve) {
    return res.status(400).json({
      message: 'ต้องให้ลูกค้าชำระค่าธรรมเนียมต่ออายุก่อน แล้วตรวจสอบสลิปที่ปุ่ม "ตรวจสอบสลิปค่าธรรมเนียม" จึงจะอนุมัติได้'
    });
  }
  await pool.query(
    `UPDATE borrow_records SET extend_status = 'rejected', extend_payment_status = 'none', extend_payment_slip_image = NULL WHERE id = ?`,
    [req.params.id]
  );
  res.json({ message: 'ปฏิเสธคำขอต่ออายุยืมแล้ว' });
});

// แอดมินตรวจสอบสลิปค่าธรรมเนียมต่ออายุยืม — อนุมัติแล้วจะบวกวันเข้า due_date จริงทันที
router.put('/borrow-records/:id/verify-extend-payment', async (req, res) => {
  const { approve } = req.body; // true = ยืนยันชำระเงิน + อนุมัติต่ออายุ, false = ปฏิเสธสลิป
  const [[record]] = await pool.query('SELECT * FROM borrow_records WHERE id = ?', [req.params.id]);
  if (!record) return res.status(404).json({ message: 'ไม่พบรายการ' });
  if (record.extend_payment_status !== 'pending_verification') {
    return res.status(400).json({ message: 'รายการนี้ไม่มีสลิปค่าธรรมเนียมต่ออายุที่รอตรวจสอบ' });
  }
  if (approve) {
    await pool.query(
      `UPDATE borrow_records
       SET due_date = DATE_ADD(due_date, INTERVAL ? DAY),
           extend_status = 'approved', extend_payment_status = 'paid', extend_paid_at = NOW()
       WHERE id = ?`,
      [record.extend_requested_days, req.params.id]
    );
  } else {
    await pool.query(
      `UPDATE borrow_records SET extend_payment_status = 'pending', extend_payment_slip_image = NULL WHERE id = ?`,
      [req.params.id]
    );
  }
  res.json({ message: approve ? 'ยืนยันชำระค่าธรรมเนียมและต่ออายุยืมสำเร็จ' : 'ปฏิเสธสลิป ลูกค้าต้องแนบสลิปใหม่' });
});

// แอดมินตรวจสอบหลักฐานการคืน แล้วยืนยันคืนสำเร็จ
// คำนวณค่าปรับเกินกำหนด (นับถึงวันที่ลูกค้าแจ้งคืน) หักจากมัดจำ แล้วสร้างยอดที่ต้องโอนคืน (refund_status = 'pending')
// แอดมินแก้ยอดค่าปรับเองได้ (เช่น ยกเว้นค่าปรับ) โดยส่ง late_fee มาใน body; การโอนเงินจริงบันทึกที่ /mark-refunded
router.put('/borrow-records/:id/confirm-return', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[record]] = await conn.query(
      `SELECT br.*, ${LATE_DAYS_SQL}, b.title, u.full_name, u.email
       FROM borrow_records br
       JOIN books b ON br.book_id = b.id
       JOIN users u ON br.user_id = u.id
       WHERE br.id = ? FOR UPDATE`, [req.params.id]);
    if (!record) { await conn.rollback(); return res.status(404).json({ message: 'ไม่พบรายการ' }); }
    if (record.status === 'returned') {
      await conn.rollback();
      return res.status(400).json({ message: 'รายการนี้ยืนยันการคืนไปแล้ว' });
    }
    if (!record.return_proof_image) {
      await conn.rollback();
      return res.status(400).json({ message: 'ลูกค้ายังไม่ได้แนบหลักฐานการคืน' });
    }

    const deposit = Number(record.deposit_amount);
    const lateDays = Math.max(Number(record.late_days_raw || 0) - LATE_FEE_GRACE_DAYS, 0);
    let lateFee = calcLateFee(lateDays, deposit);
    if (req.body && req.body.late_fee !== undefined && req.body.late_fee !== null && req.body.late_fee !== '') {
      const custom = Number(req.body.late_fee);
      if (!Number.isFinite(custom) || custom < 0 || custom > deposit) {
        await conn.rollback();
        return res.status(400).json({ message: `ค่าปรับต้องอยู่ระหว่าง 0 ถึง ${deposit} บาท (ไม่เกินค่ามัดจำ)` });
      }
      lateFee = Math.round(custom * 100) / 100;
    }
    const refundAmount = Math.round((deposit - lateFee) * 100) / 100;
    const refundStatus = refundAmount > 0 ? 'pending' : 'none';

    await conn.query(
      `UPDATE borrow_records
       SET status = 'returned', return_date = COALESCE(return_date, CURDATE()),
           late_fee = ?, refund_amount = ?, refund_status = ?, deposit_refunded = 0
       WHERE id = ?`,
      [lateFee, refundAmount, refundStatus, req.params.id]
    );
    await conn.query('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?', [record.book_id]);
    await conn.commit();

    sendMail(record.email, 'ยืนยันการคืนหนังสือสำเร็จ',
      returnConfirmedTemplate(record.full_name, record.title, deposit, lateFee, refundAmount, lateDays))
      .catch(err => console.error('[mailer] return-confirmed error:', err));

    res.json({
      message: refundAmount > 0
        ? `ยืนยันการคืนหนังสือแล้ว — ต้องโอนมัดจำคืนลูกค้า ${refundAmount} บาท (หักค่าปรับ ${lateFee} บาท)`
        : 'ยืนยันการคืนหนังสือแล้ว — ค่าปรับเท่ากับมัดจำ ไม่มียอดต้องโอนคืน',
      late_fee: lateFee, refund_amount: refundAmount, refund_status: refundStatus
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  } finally {
    conn.release();
  }
});

// แอดมินบันทึกว่าโอนเงินมัดจำคืนให้ลูกค้าแล้ว (พร้อมเลขอ้างอิง/หมายเหตุ ถ้ามี) — ส่งอีเมลแจ้งลูกค้า
router.put('/borrow-records/:id/mark-refunded', async (req, res) => {
  try {
    const reference = String((req.body && req.body.reference) || '').trim().slice(0, 100) || null;
    const [[record]] = await pool.query(
      `SELECT br.*, b.title, u.full_name, u.email
       FROM borrow_records br JOIN books b ON br.book_id = b.id JOIN users u ON br.user_id = u.id
       WHERE br.id = ?`, [req.params.id]);
    if (!record) return res.status(404).json({ message: 'ไม่พบรายการ' });
    if (record.refund_status !== 'pending') {
      return res.status(400).json({ message: 'รายการนี้ไม่มียอดที่รอโอนคืน' });
    }
    await pool.query(
      `UPDATE borrow_records
       SET refund_status = 'refunded', deposit_refunded = 1, refunded_at = NOW(), refund_reference = ?
       WHERE id = ? AND refund_status = 'pending'`,
      [reference, req.params.id]);

    sendMail(record.email, 'โอนเงินมัดจำคืนแล้ว',
      refundSentTemplate(record.full_name, record.title, record.refund_amount, reference))
      .catch(err => console.error('[mailer] refund-sent error:', err));

    res.json({ message: 'บันทึกการโอนเงินมัดจำคืนเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถบันทึกการโอนคืนได้' });
  }
});

module.exports = router;
