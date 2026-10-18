const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { SECRET, requireAuth } = require('../middleware/auth');
const { sendMail, isMailConfigured } = require('../utils/mailer');
const { authLimiter } = require('../middleware/rateLimiter');
const { buildAddressText } = require('../utils/address');

const router = express.Router();

// สมัครสมาชิก
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { full_name, email, password, phone, address_detail, subdistrict, district, province, postal_code } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
    }
    const hash = await bcrypt.hash(password, 10);
    const address = buildAddressText({ address_detail, subdistrict, district, province, postal_code });
    const [result] = await pool.query(
      `INSERT INTO users
        (full_name, email, password_hash, phone, address, address_detail, subdistrict, district, province, postal_code, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "customer")`,
      [full_name, email, hash, phone || null, address || null,
       address_detail || null, subdistrict || null, district || null, province || null, postal_code || null]
    );
    const token = jwt.sign({ id: result.insertId, email, role: 'customer' }, SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: result.insertId, full_name, email, role: 'customer' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
  }
});

// เข้าสู่ระบบ (ใช้ได้ทั้งลูกค้าและแอดมิน)
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
});

// ------------------------------------------------------------
// ลืมรหัสผ่าน: ส่งลิงก์ "สร้างรหัสผ่านใหม่" ไปยังอีเมล
// ------------------------------------------------------------
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const [rows] = await pool.query('SELECT id, full_name FROM users WHERE email = ?', [email]);
    // ตอบสำเร็จเสมอแม้ไม่พบอีเมล เพื่อไม่ให้ใช้ตรวจสอบว่าอีเมลมีอยู่ในระบบหรือไม่
    if (rows.length > 0) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // หมดอายุใน 1 ชั่วโมง
      await pool.query('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        [token, expires, rows[0].id]);
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
      if (!isMailConfigured()) {
        // ยังไม่ได้ตั้งค่า SMTP: พิมพ์ลิงก์ไว้ใน terminal ของเซิร์ฟเวอร์ (ไม่ส่งกลับไปที่หน้าเว็บ เพื่อความปลอดภัย) แล้วแจ้งผู้ใช้ตามจริง
        console.log(`[forgot-password] SMTP ยังไม่ได้ตั้งค่า — ลิงก์รีเซ็ตรหัสผ่านของ ${email}: ${resetLink}`);
        return res.status(503).json({ message: 'ระบบอีเมลยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ' });
      }
      await sendMail(email, 'สร้างรหัสผ่านใหม่ - RP Bookstore', `
        <p>สวัสดีคุณ ${rows[0].full_name},</p>
        <p>กดลิงก์ด้านล่างเพื่อสร้างรหัสผ่านใหม่ (ลิงก์นี้ใช้ได้ภายใน 1 ชั่วโมง)</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>หากคุณไม่ได้เป็นผู้ขอ สามารถเพิกเฉยอีเมลนี้ได้</p>
      `);
    }
    res.json({ message: 'หากอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์สำหรับสร้างรหัสผ่านใหม่ไปให้แล้ว' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถส่งอีเมลได้' });
  }
});

// ------------------------------------------------------------
// สร้างรหัสผ่านใหม่ด้วย token ที่ได้รับทางอีเมล
// ------------------------------------------------------------
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()', [token]);
    if (rows.length === 0) {
      return res.status(400).json({ message: 'ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่อีกครั้ง' });
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [hash, rows[0].id]);
    res.json({ message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถตั้งรหัสผ่านใหม่ได้' });
  }
});

// ------------------------------------------------------------
// เปลี่ยนรหัสผ่าน (ต้องเข้าสู่ระบบอยู่แล้ว + ยืนยันรหัสผ่านเดิม)
// ------------------------------------------------------------
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) return res.status(400).json({ message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถเปลี่ยนรหัสผ่านได้' });
  }
});

// ------------------------------------------------------------
// ข้อมูลโปรไฟล์ของฉัน / แก้ไขโปรไฟล์
// ------------------------------------------------------------
router.get('/me', requireAuth, async (req, res) => {
  const [[user]] = await pool.query(
    `SELECT id, full_name, email, phone, address,
            address_detail, subdistrict, district, province, postal_code, role
     FROM users WHERE id = ?`, [req.user.id]);
  res.json(user);
});

router.put('/me', requireAuth, async (req, res) => {
  const { full_name, phone, address_detail, subdistrict, district, province, postal_code } = req.body;
  const address = buildAddressText({ address_detail, subdistrict, district, province, postal_code });
  await pool.query(
    `UPDATE users
     SET full_name = ?, phone = ?, address = ?, address_detail = ?, subdistrict = ?, district = ?, province = ?, postal_code = ?
     WHERE id = ?`,
    [full_name, phone || null, address || null,
     address_detail || null, subdistrict || null, district || null, province || null, postal_code || null,
     req.user.id]
  );
  res.json({ message: 'บันทึกข้อมูลโปรไฟล์สำเร็จ' });
});

module.exports = router;
