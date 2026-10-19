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
// ลืมรหัสผ่านด้วยรหัส OTP 6 หลักทางอีเมล
//  - OTP หมดอายุใน 10 นาที, กรอกผิดได้ไม่เกิน 5 ครั้ง, ขอใหม่ได้ทุก 60 วินาที
//  - เก็บเฉพาะค่า hash ของ OTP ในตาราง password_reset_otps (ไม่เก็บเลขจริง)
// ------------------------------------------------------------
const OTP_TTL_MIN = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;

function hashOtp(userId, otp) {
  return crypto.createHmac('sha256', SECRET).update(`${userId}:${otp}`).digest('hex');
}

function safeEqualHex(a, b) {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    if (!email) return res.status(400).json({ message: 'กรุณากรอกอีเมล' });
    if (!isMailConfigured()) {
      return res.status(503).json({ message: 'ระบบอีเมลยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ' });
    }
    const genericOk = { message: 'หากอีเมลนี้อยู่ในระบบ เราได้ส่งรหัส OTP 6 หลักไปให้แล้ว (หมดอายุใน ' + OTP_TTL_MIN + ' นาที)' };

    const [rows] = await pool.query('SELECT id, full_name FROM users WHERE email = ?', [email]);
    // ตอบเหมือนกันเสมอแม้ไม่พบอีเมล เพื่อไม่ให้ใช้เดาว่าอีเมลไหนมีบัญชีอยู่
    if (rows.length === 0) return res.json(genericOk);
    const user = rows[0];

    // กันขอ OTP รัวๆ (สแปมอีเมล)
    const [[recent]] = await pool.query(
      'SELECT COUNT(*) AS n FROM password_reset_otps WHERE user_id = ? AND created_at > (NOW() - INTERVAL ? SECOND)',
      [user.id, OTP_RESEND_SECONDS]);
    if (recent.n > 0) {
      return res.status(429).json({ message: `กรุณารอ ${OTP_RESEND_SECONDS} วินาทีก่อนขอรหัสใหม่` });
    }

    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await pool.query('DELETE FROM password_reset_otps WHERE user_id = ?', [user.id]);
    await pool.query(
      'INSERT INTO password_reset_otps (user_id, otp_hash, expires_at) VALUES (?, ?, NOW() + INTERVAL ? MINUTE)',
      [user.id, hashOtp(user.id, otp), OTP_TTL_MIN]);

    await sendMail(email, 'รหัส OTP สำหรับตั้งรหัสผ่านใหม่ - RP Bookstore', `
      <p>สวัสดีคุณ ${user.full_name},</p>
      <p>รหัส OTP สำหรับตั้งรหัสผ่านใหม่ของคุณคือ</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:16px 0">${otp}</p>
      <p>รหัสนี้ใช้ได้ภายใน ${OTP_TTL_MIN} นาที และใช้ได้ครั้งเดียว อย่าบอกรหัสนี้กับผู้อื่น</p>
      <p>หากคุณไม่ได้เป็นผู้ขอ สามารถเพิกเฉยอีเมลนี้ได้</p>
    `);
    res.json(genericOk);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถส่งอีเมลได้ กรุณาลองใหม่อีกครั้ง' });
  }
});

// ตรวจ OTP แล้วตั้งรหัสผ่านใหม่
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    const otp = String(req.body.otp || '').trim();
    const password = String(req.body.password || '');
    const invalid = { message: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่อีกครั้ง' };

    if (!email || !/^\d{6}$/.test(otp)) return res.status(400).json(invalid);
    if (password.length < 6) return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });

    const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.status(400).json(invalid);
    const userId = users[0].id;

    const [otps] = await pool.query(
      'SELECT id, otp_hash, attempts FROM password_reset_otps WHERE user_id = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [userId]);
    if (otps.length === 0) return res.status(400).json(invalid);
    const rec = otps[0];

    if (rec.attempts >= OTP_MAX_ATTEMPTS) {
      await pool.query('DELETE FROM password_reset_otps WHERE id = ?', [rec.id]);
      return res.status(429).json({ message: 'กรอกรหัสผิดเกินกำหนด กรุณาขอรหัสใหม่อีกครั้ง' });
    }
    if (!safeEqualHex(rec.otp_hash, hashOtp(userId, otp))) {
      await pool.query('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?', [rec.id]);
      return res.status(400).json({ message: 'รหัส OTP ไม่ถูกต้อง' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [hash, userId]);
    await pool.query('DELETE FROM password_reset_otps WHERE user_id = ?', [userId]);
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
