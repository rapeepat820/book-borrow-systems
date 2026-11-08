const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadBookCover, useCloudinary } = require('../middleware/upload');
const { lookupBook } = require('../utils/bookLookup');
const { runAutoSetup, getStatus: autoFillStatus } = require('../utils/bookAutoSetup');
const { sendMail, dueDateReminderTemplate, shippedTemplate, returnConfirmedTemplate, refundSentTemplate, contactReplyTemplate, idApprovedTemplate, idRejectedTemplate } = require('../utils/mailer');
const { CONTACT_FIELDS, getContactSettings } = require('./contact');
const { decrypt } = require('../utils/idCrypto');
const { ShippingError, getShippingQuote } = require('../utils/shippingRates');
const { calcDueDate, calcDeposit, calcLateFee, LATE_DAYS_SQL, LATE_FEE_GRACE_DAYS, attachLateInfo } = require('../utils/calcBorrow');
const { effectiveAvailable, fulfillReservation, promoteReservations } = require('../utils/reservations');
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
  // ข้อความติดต่อใหม่ที่ยังไม่ได้ตอบ (ถ้ายังไม่ได้รัน migration v9 ให้นับเป็น 0 แทนที่จะทำให้แดชบอร์ดพัง)
  let newMessages = 0;
  try {
    [[{ newMessages }]] = await pool.query("SELECT COUNT(*) AS newMessages FROM contact_messages WHERE status = 'new'");
  } catch (err) { /* ตารางยังไม่มี */ }
  let waitingReservations = 0;
  try {
    [[{ waitingReservations }]] = await pool.query("SELECT COUNT(*) AS waitingReservations FROM book_reservations WHERE status IN ('waiting','ready')");
  } catch (err) { /* ตารางยังไม่มี */ }
  let pendingIdVerifications = 0;
  try {
    [[{ pendingIdVerifications }]] = await pool.query("SELECT COUNT(*) AS pendingIdVerifications FROM id_verifications WHERE status = 'pending'");
  } catch (err) { /* ตารางยังไม่มี */ }
  res.json({
    totalBooks, totalMembers, activeBorrows, overdueCount,
    pendingPaymentVerification, pendingExtendVerification, pendingReturnCheck, pendingRefunds, newMessages, waitingReservations, pendingIdVerifications
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
    publisher, publish_year, edition, volume, print_no, weight_g
  } = req.body;
  const [result] = await pool.query(
    `INSERT INTO books (title, author, cover_image, description, book_type_id, total_copies, available_copies, price_value,
       publisher, publish_year, edition, volume, print_no, weight_g)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, author, cover_image || null, description || null, book_type_id, total_copies, total_copies, price_value || 0,
      publisher || null, publish_year || null, edition || null, volume || null, print_no || null, Number(weight_g) > 0 ? Number(weight_g) : 300]
  );
  res.status(201).json({ id: result.insertId });
});

router.put('/books/:id', async (req, res) => {
  const {
    title, author, cover_image, description, book_type_id, total_copies, price_value,
    publisher, publish_year, edition, volume, print_no, weight_g
  } = req.body;
  await pool.query(
    `UPDATE books SET title=?, author=?, cover_image=?, description=?, book_type_id=?, total_copies=?, price_value=?,
       publisher=?, publish_year=?, edition=?, volume=?, print_no=?, weight_g=? WHERE id=?`,
    [title, author, cover_image, description, book_type_id, total_copies, price_value,
      publisher || null, publish_year || null, edition || null, volume || null, print_no || null,
      Number(weight_g) > 0 ? Number(weight_g) : 300, req.params.id]
  );
  res.json({ message: 'อัปเดตข้อมูลหนังสือสำเร็จ' });
});

router.delete('/books/:id', async (req, res) => {
  // หนังสือที่เคยมีคนยืมลบไม่ได้ (ต้องเก็บประวัติไว้) — ถ้าไม่อยากให้แสดง ให้ปรับจำนวนเล่มเป็น 0 แทน
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM borrow_records WHERE book_id = ?', [req.params.id]);
  if (n > 0) {
    return res.status(409).json({ message: `ลบไม่ได้ เพราะหนังสือเล่มนี้มีประวัติการยืม ${n} รายการ (ลบได้เฉพาะเล่มที่ไม่เคยมีคนยืม)` });
  }
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
    const { name, base_fee, fee_per_book, delivery_days, tracking_url, is_active, base_weight_g, fee_per_extra_kg, rate_provider, markup_percent } = req.body;
    await conn.beginTransaction();
    const wantActive = !!is_active;
    if (wantActive) {
      await conn.query('UPDATE shipping_companies SET is_active = 0');
    }
    const [result] = await conn.query(
      'INSERT INTO shipping_companies (name, base_fee, fee_per_book, delivery_days, tracking_url, is_active, base_weight_g, fee_per_extra_kg, rate_provider, markup_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, base_fee, fee_per_book || 0, delivery_days, tracking_url || null, wantActive ? 1 : 0, Number(base_weight_g) > 0 ? Number(base_weight_g) : 1000, Number(fee_per_extra_kg) || 0,
        rate_provider === 'flash' ? 'flash' : 'manual', Math.min(Math.max(Number(markup_percent) || 0, 0), 100)]
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
    const { name, base_fee, fee_per_book, delivery_days, tracking_url, is_active, base_weight_g, fee_per_extra_kg, rate_provider, markup_percent } = req.body;
    await conn.beginTransaction();
    const wantActive = !!is_active;
    if (wantActive) {
      await conn.query('UPDATE shipping_companies SET is_active = 0 WHERE id <> ?', [req.params.id]);
    }
    await conn.query(
      'UPDATE shipping_companies SET name=?, base_fee=?, fee_per_book=?, delivery_days=?, tracking_url=?, is_active=?, base_weight_g=?, fee_per_extra_kg=?, rate_provider=?, markup_percent=? WHERE id=?',
      [name, base_fee, fee_per_book || 0, delivery_days, tracking_url || null, wantActive ? 1 : 0,
        Number(base_weight_g) > 0 ? Number(base_weight_g) : 1000, Number(fee_per_extra_kg) || 0,
        rate_provider === 'flash' ? 'flash' : 'manual', Math.min(Math.max(Number(markup_percent) || 0, 0), 100), req.params.id]
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
    "SELECT id, full_name, email, phone, address, created_at, id_verify_status FROM users WHERE role='customer' ORDER BY id DESC");
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
    // สมาชิกที่แอดมินเพิ่มเอง (เช่น มาสมัครหน้าร้าน) ถือว่าแอดมินยืนยันตัวตนต่อหน้าแล้ว
    'INSERT INTO users (full_name, email, password_hash, phone, address, role, id_verify_status, id_verified_at) VALUES (?, ?, ?, ?, ?, "customer", "verified", NOW())',
    [full_name, email, hash, phone || null, address || null]
  );
  res.status(201).json({ id: result.insertId, temp_password: tempPassword,
    message: 'เพิ่มลูกค้าสำเร็จ (รหัสผ่านชั่วคราวถูกสร้างให้แล้ว แนะนำให้ลูกค้ากด "ลืมรหัสผ่าน" เพื่อตั้งรหัสใหม่)' });
});

// ================= Borrow Records Management =================
router.get('/borrow-records', async (req, res) => {
  const { status } = req.query;
  let sql = `SELECT br.*, ${LATE_DAYS_SQL}, b.title, u.full_name, u.email, sc.name AS shipping_company_name,
                    (SELECT COUNT(*) FROM borrow_records o WHERE o.order_id = br.order_id) AS order_item_count
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
    if (!book || await effectiveAvailable(conn, book, user_id) < 1) {
      await conn.rollback();
      return res.status(400).json({ message: 'หนังสือเล่มนี้ไม่พร้อมให้ยืม (ถูกยืมหมดหรือกันไว้ให้ผู้จองคิว)' });
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

    const [[mem]] = await conn.query('SELECT postal_code FROM users WHERE id = ?', [user_id]);
    const sq = await getShippingQuote({ company: shipping, books: [book], dstPostal: mem && mem.postal_code });
    const shipping_fee = sq.fee;
    const deposit_amount = calcDeposit({ deposit_amount: book.type_deposit }, book);
    const borrow_date = new Date().toISOString().slice(0, 10);
    const due_date = calcDueDate(borrow_date, book.borrow_days, shipping.delivery_days);

    const [result] = await conn.query(
      `INSERT INTO borrow_records (user_id, book_id, shipping_company_id, shipping_address, shipping_fee, deposit_amount, borrow_date, due_date, status, payment_status, payment_method, paid_at,
         box_name, parcel_weight_g, shipping_rate_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_shipment', 'paid', 'cash', NOW(), ?, ?, ?)`,
      [user_id, book_id, shipping_company_id, address, shipping_fee, deposit_amount, borrow_date, due_date, sq.box.name, sq.parcel_weight_g, sq.source]
    );
    await conn.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?', [book_id]);
    await fulfillReservation(conn, user_id, book_id, result.insertId);
    await conn.commit();
    res.status(201).json({ id: result.insertId, message: 'เพิ่มรายการยืมสำเร็จ' });
  } catch (err) {
    await conn.rollback();
    if (err instanceof ShippingError) return res.status(err.status).json({ message: err.message });
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
  const { shipping_status, tracking_no, actual_cost } = req.body;
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

  // ออเดอร์หลายเล่มส่งเป็นพัสดุเดียว: อัปเดตสถานะและเลข tracking ให้ทุกเล่มในออเดอร์พร้อมกัน
  const [group] = record.order_id
    ? await pool.query('SELECT * FROM borrow_records WHERE order_id = ?', [record.order_id])
    : [[record]];

  // เมื่อเริ่มจัดส่งจริง (shipped ขึ้นไป) ให้ปรับสถานะหลักของรายการเป็น "กำลังยืม" ด้วย
  const startShipping = SHIPPING_STAGES.indexOf(shipping_status) >= SHIPPING_STAGES.indexOf('shipped');
  for (const r of group) {
    const newMainStatus = startShipping && r.status === 'pending_shipment' ? 'borrowing' : r.status;
    await pool.query(
      `UPDATE borrow_records SET shipping_status = ?, tracking_no = ?, status = ? WHERE id = ?`,
      [shipping_status, finalTrackingNo || null, newMainStatus, r.id]
    );
  }

  // ต้นทุนค่าส่งจริงที่ขนส่งเก็บจากร้าน เก็บไว้ที่รายการแรกของพัสดุ (ใช้เทียบกับค่าส่งที่เก็บจากลูกค้าในรายงาน)
  if (actual_cost !== undefined && actual_cost !== null && actual_cost !== '' && Number(actual_cost) >= 0) {
    await pool.query('UPDATE borrow_records SET shipping_cost_actual = ? WHERE id = ?', [Number(actual_cost), group[0].id]).catch(err => console.error('[ship] บันทึกต้นทุนจริงไม่สำเร็จ:', err.message));
  }

  if (shipping_status === 'shipped') {
    const [full] = await pool.query(
      `SELECT br.due_date, b.title, u.full_name, u.email FROM borrow_records br
       JOIN books b ON br.book_id=b.id JOIN users u ON br.user_id=u.id WHERE br.id IN (?) ORDER BY br.id`, [group.map(r => r.id)]);
    if (full.length) {
      const titles = full.map(f => f.title).join(', ');
      const lastDue = full.map(f => String(f.due_date).slice(0, 10)).sort().pop();
      sendMail(full[0].email, 'พัสดุหนังสือของคุณถูกจัดส่งแล้ว',
        shippedTemplate(full[0].full_name, titles, lastDue, finalTrackingNo))
        .catch(err => console.error('[mailer] shipped-notification error:', err));
    }
  }

  res.json({ message: group.length > 1 ? `อัปเดตสถานะจัดส่งสำเร็จ (ทั้งออเดอร์ ${group.length} เล่ม)` : 'อัปเดตสถานะจัดส่งสำเร็จ' });
});

// แอดมินตรวจสอบสลิปโอนเงินที่ลูกค้าแนบ แล้วยืนยัน/ปฏิเสธการชำระเงิน
router.put('/borrow-records/:id/verify-payment', async (req, res) => {
  const { approve } = req.body; // true = ยืนยันว่าชำระเงินถูกต้อง, false = ปฏิเสธสลิป (ให้ลูกค้าแนบใหม่)
  const [[record]] = await pool.query('SELECT * FROM borrow_records WHERE id = ?', [req.params.id]);
  if (!record) return res.status(404).json({ message: 'ไม่พบรายการ' });
  if (record.payment_status !== 'pending_verification') {
    return res.status(400).json({ message: 'รายการนี้ไม่มีสลิปที่รอตรวจสอบ' });
  }
  // ออเดอร์หลายเล่มใช้สลิปใบเดียว: ยืนยัน/ปฏิเสธให้ทั้งออเดอร์
  const where = record.order_id ? 'order_id = ? AND payment_status = \'pending_verification\'' : 'id = ?';
  const arg = record.order_id || req.params.id;
  if (approve) {
    await pool.query(`UPDATE borrow_records SET payment_status = 'paid', paid_at = NOW() WHERE ${where}`, [arg]);
  } else {
    await pool.query(`UPDATE borrow_records SET payment_status = 'pending', payment_slip_image = NULL WHERE ${where}`, [arg]);
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
// ยอดทั้งหมดคำนวณโดยระบบ (แก้เองไม่ได้); การโอนเงินจริงบันทึกที่ /mark-refunded
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
    // ค่าปรับและยอดคืนมัดจำกำหนดโดยระบบตามกติกา (วันละ X บาท ไม่เกินมัดจำ) แอดมินแก้ตัวเลขเองไม่ได้
    const lateFee = calcLateFee(lateDays, deposit);
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

    // มีเล่มว่างแล้ว → ให้สิทธิ์แก่ผู้จองคิวคนแรก (ถ้ามี) และแจ้งทางอีเมล
    promoteReservations(record.book_id).catch(err => console.error('[reservations] promote error:', err.message));

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

// ================= กล่องจัดส่ง + ตั้งค่าขอราคาขนส่ง =================
router.get('/shipping-boxes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM shipping_boxes ORDER BY sort_order, id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'โหลดข้อมูลกล่องไม่สำเร็จ (ลองรัน migration v12 แล้วหรือยัง)' });
  }
});

function boxFields(b) {
  const int = (v, min = 1) => Math.max(Math.round(Number(v) || 0), min);
  const name = String(b.name || '').trim().slice(0, 40);
  if (!name) return null;
  return [name, int(b.max_items), int(b.max_book_weight_g), int(b.length_cm), int(b.width_cm), int(b.height_cm), int(b.packaging_weight_g, 0), b.is_active === 0 || b.is_active === false ? 0 : 1, int(b.sort_order, 0)];
}
router.post('/shipping-boxes', async (req, res) => {
  const f = boxFields(req.body || {});
  if (!f) return res.status(400).json({ message: 'กรุณาระบุชื่อกล่อง' });
  const [r] = await pool.query(
    'INSERT INTO shipping_boxes (name, max_items, max_book_weight_g, length_cm, width_cm, height_cm, packaging_weight_g, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', f);
  res.status(201).json({ id: r.insertId, message: 'เพิ่มกล่องแล้ว' });
});
router.put('/shipping-boxes/:id', async (req, res) => {
  const f = boxFields(req.body || {});
  if (!f) return res.status(400).json({ message: 'กรุณาระบุชื่อกล่อง' });
  await pool.query(
    'UPDATE shipping_boxes SET name=?, max_items=?, max_book_weight_g=?, length_cm=?, width_cm=?, height_cm=?, packaging_weight_g=?, is_active=?, sort_order=? WHERE id=?', [...f, req.params.id]);
  res.json({ message: 'บันทึกกล่องแล้ว' });
});
router.delete('/shipping-boxes/:id', async (req, res) => {
  await pool.query('DELETE FROM shipping_boxes WHERE id = ?', [req.params.id]);
  res.json({ message: 'ลบกล่องแล้ว' });
});

router.get('/shipping-settings', async (req, res) => {
  let postal = '';
  try {
    const [[row]] = await pool.query("SELECT setting_value FROM site_settings WHERE setting_key = 'ship_from_postal'");
    postal = (row && row.setting_value) || process.env.SHIP_FROM_POSTAL || '';
  } catch (err) { postal = process.env.SHIP_FROM_POSTAL || ''; }
  res.json({ ship_from_postal: postal, flash_configured: !!(process.env.FLASH_MCH_ID && process.env.FLASH_SECRET_KEY), flash_base: process.env.FLASH_API_BASE || 'https://open-api.flashexpress.com' });
});
router.put('/shipping-settings', async (req, res) => {
  const postal = String((req.body && req.body.ship_from_postal) || '').trim();
  if (postal && !/^\d{5}$/.test(postal)) return res.status(400).json({ message: 'รหัสไปรษณีย์ต้นทางต้องเป็นตัวเลข 5 หลัก' });
  await pool.query("INSERT INTO site_settings (setting_key, setting_value) VALUES ('ship_from_postal', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [postal]);
  res.json({ message: 'บันทึกรหัสไปรษณีย์ต้นทางแล้ว' });
});

// ทดลองคำนวณค่าส่ง (ไว้ตรวจว่าตั้งค่า API ถูกต้อง): ?company_id=&postal=&items=1 หรือ book_ids=1,2
router.get('/shipping-test', async (req, res) => {
  try {
    const [[company]] = await pool.query('SELECT * FROM shipping_companies WHERE id = ?', [req.query.company_id]);
    if (!company) return res.status(404).json({ message: 'ไม่พบบริษัทขนส่ง' });
    const ids = String(req.query.book_ids || '').split(',').map(Number).filter(n => n > 0).slice(0, 5);
    const [books] = ids.length ? await pool.query('SELECT * FROM books WHERE id IN (?)', [ids]) : await pool.query('SELECT * FROM books LIMIT ?', [Math.min(Math.max(Number(req.query.items) || 1, 1), 5)]);
    const q = await getShippingQuote({ company, books, dstPostal: String(req.query.postal || '') });
    res.json({ box: q.box.name, parcel_weight_g: q.parcel_weight_g, fee: q.fee, source: q.source, note: q.note, books: books.length });
  } catch (err) {
    if (err instanceof ShippingError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: 'ทดลองคำนวณไม่สำเร็จ' });
  }
});

// ================= ยืนยันตัวตนสมาชิก =================
// รูปและเลขบัตรเก็บแบบเข้ารหัส ส่งให้ดูผ่านฟังก์ชันนี้เท่านั้น (ต้องเป็นแอดมิน) และถูกลบทิ้งทันทีหลังอนุมัติ/ปฏิเสธ
router.get('/id-verifications', async (req, res) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const [rows] = await pool.query(
      `SELECT v.id, v.user_id, v.status, v.id_hash, v.id_last4, v.id_number_enc, v.created_at, v.reviewed_at, v.reject_reason,
              (v.id_card_image IS NOT NULL) AS has_images, u.full_name, u.email, u.phone,
              (SELECT x.full_name FROM users x WHERE x.national_id_hash = v.id_hash AND x.id <> v.user_id LIMIT 1) AS duplicate_of
       FROM id_verifications v JOIN users u ON v.user_id = u.id
       WHERE v.status = ? ORDER BY v.created_at ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT 100`, [status]);
    res.json(rows.map(r => {
      let id_number = null;
      if (r.status === 'pending' && r.id_number_enc) {
        try { id_number = decrypt(r.id_number_enc).toString('utf8'); } catch { id_number = null; }
      }
      const { id_number_enc, id_hash, ...rest } = r;
      return { ...rest, id_number, has_images: !!r.has_images };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถโหลดคำขอยืนยันตัวตนได้ (ลองรัน migration v11 แล้วหรือยัง)' });
  }
});

router.get('/id-verifications/:id/image/:kind', async (req, res) => {
  try {
    const col = req.params.kind === 'card' ? 'id_card_image' : req.params.kind === 'selfie' ? 'selfie_image' : null;
    if (!col) return res.status(400).json({ message: 'ประเภทรูปไม่ถูกต้อง' });
    const [[row]] = await pool.query(`SELECT ${col} AS img FROM id_verifications WHERE id = ? AND status = 'pending'`, [req.params.id]);
    if (!row || !row.img) return res.status(404).json({ message: 'ไม่พบรูป (อาจถูกลบหลังตรวจสอบแล้ว)' });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(decrypt(row.img));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถเปิดรูปได้' });
  }
});

async function finishVerification(req, res, approve) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[v]] = await conn.query(
      `SELECT v.*, u.full_name, u.email FROM id_verifications v JOIN users u ON v.user_id = u.id WHERE v.id = ? FOR UPDATE`, [req.params.id]);
    if (!v) { await conn.rollback(); return res.status(404).json({ message: 'ไม่พบคำขอ' }); }
    if (v.status !== 'pending') { await conn.rollback(); return res.status(400).json({ message: 'คำขอนี้ตรวจสอบไปแล้ว' }); }
    const reason = String((req.body && req.body.reason) || '').trim().slice(0, 255);
    if (!approve && !reason) { await conn.rollback(); return res.status(400).json({ message: 'กรุณาระบุเหตุผลที่ไม่ผ่าน เพื่อแจ้งให้ผู้สมัครแก้ไข' }); }

    if (approve) {
      const [[dup]] = await conn.query('SELECT id FROM users WHERE national_id_hash = ? AND id <> ?', [v.id_hash, v.user_id]);
      if (dup) { await conn.rollback(); return res.status(409).json({ message: 'เลขบัตรนี้ถูกยืนยันกับบัญชีอื่นไปแล้ว ไม่สามารถอนุมัติซ้ำได้ (ควรปฏิเสธคำขอนี้)' }); }
      await conn.query(
        "UPDATE users SET id_verify_status = 'verified', national_id_hash = ?, national_id_last4 = ?, id_verified_at = NOW(), id_reject_reason = NULL WHERE id = ?",
        [v.id_hash, v.id_last4, v.user_id]);
    } else {
      await conn.query("UPDATE users SET id_verify_status = 'rejected', id_reject_reason = ? WHERE id = ?", [reason, v.user_id]);
    }
    // ลบรูปและเลขบัตรเต็มทิ้งทันที เหลือเฉพาะค่าแฮชกับเลข 4 ตัวท้าย
    await conn.query(
      `UPDATE id_verifications SET status = ?, reviewed_at = NOW(), reviewed_by = ?, reject_reason = ?,
              id_number_enc = NULL, id_card_image = NULL, selfie_image = NULL WHERE id = ?`,
      [approve ? 'approved' : 'rejected', req.user.id, approve ? null : reason, v.id]);
    await conn.commit();

    sendMail(v.email, approve ? 'ยืนยันตัวตนสำเร็จ - ยืมหนังสือได้แล้ว' : 'ยืนยันตัวตนไม่ผ่าน - กรุณาส่งข้อมูลใหม่',
      approve ? idApprovedTemplate(v.full_name) : idRejectedTemplate(v.full_name, reason))
      .catch(err => console.error('[mailer] id-verification error:', err.message));
    res.json({ message: approve ? 'อนุมัติแล้ว และลบรูปบัตร/เซลฟี่ออกจากระบบเรียบร้อย' : 'ปฏิเสธแล้ว และลบรูปออกจากระบบเรียบร้อย' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถบันทึกผลการตรวจสอบได้' });
  } finally {
    conn.release();
  }
}
router.put('/id-verifications/:id/approve', (req, res) => finishVerification(req, res, true));
router.put('/id-verifications/:id/reject', (req, res) => finishVerification(req, res, false));

// ================= รายงานสถิติ =================
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
function parseRange(q) {
  const today = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  let to = DAY_RE.test(q.to || '') ? q.to : iso(today);
  let from = DAY_RE.test(q.from || '') ? q.from : iso(new Date(today.getTime() - 29 * 86400000));
  if (from > to) [from, to] = [to, from];
  const span = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  if (span > 731) from = iso(new Date(new Date(to).getTime() - 730 * 86400000)); // ไม่เกิน 2 ปีต่อครั้ง
  return { from, to, span: Math.min(span, 731) };
}
async function safe(fn, fallback) { try { return await fn(); } catch (err) { console.error('[reports]', err.message); return fallback; } }
const num = v => Number(v || 0);

router.get('/reports', async (req, res) => {
  try {
    const { from, to, span } = parseRange(req.query);
    const range = [from, to];

    const [[b]] = await pool.query(
      `SELECT COUNT(*) AS borrows, COUNT(DISTINCT user_id) AS borrowers, COUNT(DISTINCT book_id) AS distinct_books,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN shipping_fee END), 0) AS shipping_income,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN deposit_amount END), 0) AS deposits_received
       FROM borrow_records WHERE borrow_date BETWEEN ? AND ?`, range);
    const [[r]] = await pool.query(
      `SELECT COUNT(*) AS returns_count, COALESCE(SUM(return_date <= due_date), 0) AS on_time,
              COALESCE(SUM(late_fee), 0) AS late_fee_income, COALESCE(SUM(CASE WHEN refund_status = 'refunded' THEN refund_amount END), 0) AS refunded
       FROM borrow_records WHERE status = 'returned' AND return_date BETWEEN ? AND ?`, range);
    const [[ext]] = await pool.query(
      `SELECT COALESCE(SUM(extend_fee), 0) AS extend_income, COUNT(*) AS extends
       FROM borrow_records WHERE extend_payment_status = 'paid' AND DATE(extend_paid_at) BETWEEN ? AND ?`, range);
    const [[m]] = await pool.query("SELECT COUNT(*) AS new_members FROM users WHERE role <> 'admin' AND DATE(created_at) BETWEEN ? AND ?", range);
    const [[now]] = await pool.query(
      `SELECT
         (SELECT COALESCE(SUM(deposit_amount), 0) FROM borrow_records WHERE payment_status = 'paid' AND status IN ('pending_shipment','borrowing','return_requested')) AS deposits_held,
         (SELECT COALESCE(SUM(refund_amount), 0) FROM borrow_records WHERE refund_status = 'pending') AS refunds_pending,
         (SELECT COUNT(*) FROM borrow_records WHERE status = 'borrowing' AND due_date < CURDATE()) AS overdue_now,
         (SELECT COUNT(*) FROM books WHERE available_copies <= 0) AS out_of_stock,
         (SELECT COUNT(*) FROM books) AS total_titles`);

    // ต้นทุนค่าส่งจริงที่ขนส่งเก็บจากร้าน (แอดมินกรอกตอนส่งพัสดุ) — ใช้เทียบกับค่าส่งที่เก็บจากลูกค้า
    const shipCost = await safe(async () => {
      const [[x]] = await pool.query(
        `SELECT COALESCE(SUM(shipping_cost_actual), 0) AS cost, COUNT(shipping_cost_actual) AS n,
                COALESCE(SUM(CASE WHEN shipping_cost_actual IS NOT NULL THEN
                  (SELECT SUM(o.shipping_fee) FROM borrow_records o WHERE (br.order_id IS NOT NULL AND o.order_id = br.order_id) OR (br.order_id IS NULL AND o.id = br.id)) END), 0) AS charged
         FROM borrow_records br WHERE borrow_date BETWEEN ? AND ?`, range);
      return { cost: num(x.cost), parcels: num(x.n), charged: num(x.charged) };
    }, { cost: 0, parcels: 0, charged: 0 });

    const byMonth = span > 92;
    const [series] = await pool.query(
      `SELECT DATE_FORMAT(borrow_date, ?) AS label, COUNT(*) AS n
       FROM borrow_records WHERE borrow_date BETWEEN ? AND ? GROUP BY label ORDER BY label`,
      [byMonth ? '%Y-%m' : '%Y-%m-%d', ...range]);
    const [topBooks] = await pool.query(
      `SELECT b.id, b.title, COUNT(*) AS n FROM borrow_records br JOIN books b ON br.book_id = b.id
       WHERE br.borrow_date BETWEEN ? AND ? GROUP BY b.id, b.title ORDER BY n DESC, b.title LIMIT 10`, range);
    const [byType] = await pool.query(
      `SELECT bt.type_name AS label, COUNT(*) AS n FROM borrow_records br
       JOIN books b ON br.book_id = b.id JOIN book_types bt ON b.book_type_id = bt.id
       WHERE br.borrow_date BETWEEN ? AND ? GROUP BY bt.id, bt.type_name ORDER BY n DESC`, range);
    const [topMembers] = await pool.query(
      `SELECT u.full_name AS label, COUNT(*) AS n FROM borrow_records br JOIN users u ON br.user_id = u.id
       WHERE br.borrow_date BETWEEN ? AND ? GROUP BY u.id, u.full_name ORDER BY n DESC LIMIT 5`, range);

    // ส่วนที่ต้องมีตารางจาก migration v10 — ถ้ายังไม่ได้รันจะเป็นศูนย์แทนที่จะทำให้รายงานพัง
    const orders = await safe(async () => {
      const [[o]] = await pool.query('SELECT COUNT(*) AS multi_orders, COALESCE(SUM(item_count), 0) AS multi_books FROM borrow_orders WHERE DATE(created_at) BETWEEN ? AND ?', range);
      return { multi_orders: num(o.multi_orders), multi_books: num(o.multi_books) };
    }, { multi_orders: 0, multi_books: 0 });
    const reservations = await safe(async () => {
      const [[x]] = await pool.query(
        `SELECT COUNT(*) AS created, COALESCE(SUM(status = 'fulfilled'), 0) AS fulfilled, COALESCE(SUM(status = 'expired'), 0) AS expired
         FROM book_reservations WHERE DATE(created_at) BETWEEN ? AND ?`, range);
      const [[w]] = await pool.query("SELECT COUNT(*) AS waiting FROM book_reservations WHERE status IN ('waiting','ready')");
      const [queue] = await pool.query(
        `SELECT b.id, b.title, COUNT(*) AS n FROM book_reservations rs JOIN books b ON rs.book_id = b.id
         WHERE rs.status IN ('waiting','ready') GROUP BY b.id, b.title ORDER BY n DESC, b.title LIMIT 10`);
      return { created: num(x.created), fulfilled: num(x.fulfilled), expired: num(x.expired), waiting_now: num(w.waiting), queue };
    }, { created: 0, fulfilled: 0, expired: 0, waiting_now: 0, queue: [] });

    const returnsCount = num(r.returns_count);
    res.json({
      range: { from, to, span, group: byMonth ? 'month' : 'day' },
      summary: {
        borrows: num(b.borrows), borrowers: num(b.borrowers), distinct_books: num(b.distinct_books),
        new_members: num(m.new_members), returns: returnsCount,
        on_time_rate: returnsCount ? Math.round(num(r.on_time) / returnsCount * 1000) / 10 : null,
        extends: num(ext.extends),
        income: {
          shipping: num(b.shipping_income), late_fee: num(r.late_fee_income), extend: num(ext.extend_income),
          total: num(b.shipping_income) + num(r.late_fee_income) + num(ext.extend_income)
        },
        shipping_cost: shipCost,
        deposits_received: num(b.deposits_received), refunded: num(r.refunded)
      },
      now: {
        deposits_held: num(now.deposits_held), refunds_pending: num(now.refunds_pending),
        overdue_now: num(now.overdue_now), out_of_stock: num(now.out_of_stock), total_titles: num(now.total_titles)
      },
      orders, reservations, series, top_books: topBooks, by_type: byType, top_members: topMembers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถสร้างรายงานได้' });
  }
});

// ดาวน์โหลดรายการยืม-คืนในช่วงวันที่เป็น CSV (เปิดใน Excel ได้ มี BOM ให้ภาษาไทยไม่เพี้ยน)
router.get('/reports/export', async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const [rows] = await pool.query(
      `SELECT br.id, br.order_id, br.borrow_date, u.full_name, u.email, b.title, bt.type_name,
              br.due_date, br.return_date, br.status, br.shipping_fee, br.deposit_amount, br.late_fee, br.refund_amount, br.refund_status, br.payment_status
       FROM borrow_records br
       JOIN users u ON br.user_id = u.id JOIN books b ON br.book_id = b.id JOIN book_types bt ON b.book_type_id = bt.id
       WHERE br.borrow_date BETWEEN ? AND ? ORDER BY br.borrow_date, br.id`, [from, to]);
    const head = ['รหัสรายการ', 'ออเดอร์', 'วันที่ยืม', 'ชื่อสมาชิก', 'อีเมล', 'หนังสือ', 'ประเภท', 'กำหนดคืน', 'วันที่คืน', 'สถานะ', 'ค่าส่ง', 'มัดจำ', 'ค่าปรับ', 'ยอดคืนมัดจำ', 'สถานะคืนมัดจำ', 'สถานะชำระเงิน'];
    const day = v => (v ? String(v).slice(0, 10) : '');
    // กันสูตร Excel (ข้อความที่ขึ้นต้นด้วย = + - @ จะถูกตีความเป็นสูตร) แล้วครอบเครื่องหมายคำพูด
    const cell = v => {
      let t = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
      return '"' + t.replace(/"/g, '""') + '"';
    };
    const lines = [head.map(cell).join(',')];
    rows.forEach(r => lines.push([r.id, r.order_id || '', day(r.borrow_date), r.full_name, r.email, r.title, r.type_name,
      day(r.due_date), day(r.return_date), r.status, r.shipping_fee, r.deposit_amount, r.late_fee, r.refund_amount, r.refund_status, r.payment_status].map(cell).join(',')));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="borrow-report-${from}_${to}.csv"`);
    res.send('\uFEFF' + lines.join('\r\n'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถส่งออกรายงานได้' });
  }
});

// ================= ข้อความติดต่อ + ตั้งค่าช่องทางติดต่อ =================
router.get('/contact-messages', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT cm.*, br.id AS record_id, b.title AS record_title
               FROM contact_messages cm
               LEFT JOIN borrow_records br ON cm.borrow_record_id = br.id
               LEFT JOIN books b ON br.book_id = b.id`;
    const params = [];
    if (['new', 'replied', 'closed'].includes(status)) { sql += ' WHERE cm.status = ?'; params.push(status); }
    sql += ' ORDER BY (cm.status = \'new\') DESC, cm.created_at DESC LIMIT 200';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถโหลดข้อความได้ (ลองรัน migration v9 แล้วหรือยัง)' });
  }
});

// ตอบกลับลูกค้าทางอีเมล + บันทึกคำตอบไว้ให้ลูกค้าเห็นในหน้า "ติดต่อเจ้าหน้าที่"
router.put('/contact-messages/:id/reply', async (req, res) => {
  try {
    const reply = String((req.body && req.body.reply) || '').trim().slice(0, 3000);
    if (reply.length < 2) return res.status(400).json({ message: 'กรุณาพิมพ์ข้อความตอบกลับ' });
    const [[msg]] = await pool.query('SELECT * FROM contact_messages WHERE id = ?', [req.params.id]);
    if (!msg) return res.status(404).json({ message: 'ไม่พบข้อความ' });

    await pool.query(
      "UPDATE contact_messages SET admin_reply = ?, status = 'replied', replied_at = NOW() WHERE id = ?", [reply, req.params.id]);

    let emailed = false;
    try {
      emailed = await sendMail(msg.email, `ตอบกลับ: ${msg.subject}`, contactReplyTemplate(msg.name, msg.subject, msg.message, reply));
    } catch (err) {
      console.error('[contact] ส่งอีเมลตอบกลับไม่สำเร็จ:', err.message);
    }
    res.json({
      message: emailed ? 'ตอบกลับและส่งอีเมลถึงลูกค้าแล้ว' : 'บันทึกคำตอบแล้ว แต่ส่งอีเมลไม่สำเร็จ (ลูกค้ายังเห็นคำตอบในหน้าติดต่อเจ้าหน้าที่ หากล็อกอินอยู่)',
      emailed
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถบันทึกคำตอบได้' });
  }
});

router.put('/contact-messages/:id/status', async (req, res) => {
  const status = req.body && req.body.status;
  if (!['new', 'replied', 'closed'].includes(status)) return res.status(400).json({ message: 'สถานะไม่ถูกต้อง' });
  await pool.query('UPDATE contact_messages SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json({ message: 'อัปเดตสถานะแล้ว' });
});

router.get('/contact-settings', async (req, res) => {
  try {
    res.json(await getContactSettings());
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถโหลดการตั้งค่าได้ (ลองรัน migration v9 แล้วหรือยัง)' });
  }
});

router.put('/contact-settings', async (req, res) => {
  try {
    const body = req.body || {};
    const limits = { shop_name: 100, phone: 40, line_id: 60, line_url: 255, email: 150, facebook_url: 255, address: 500, hours: 255, note: 500 };
    for (const key of CONTACT_FIELDS) {
      if (body[key] === undefined) continue;
      const value = String(body[key]).trim().slice(0, limits[key]);
      if (['line_url', 'facebook_url'].includes(key) && value && !/^https?:\/\//i.test(value)) {
        return res.status(400).json({ message: 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://' });
      }
      if (key === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return res.status(400).json({ message: 'รูปแบบอีเมลร้านไม่ถูกต้อง' });
      }
      await pool.query(
        'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [key, value]);
    }
    res.json({ message: 'บันทึกช่องทางติดต่อเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถบันทึกการตั้งค่าได้' });
  }
});

module.exports = router;
