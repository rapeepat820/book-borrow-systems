// ช่องทางติดต่อเจ้าหน้าที่: ข้อมูลติดต่อของร้าน (สาธารณะ) + ฟอร์มส่งข้อความ + ดูข้อความของฉัน
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { requireAuth, SECRET } = require('../middleware/auth');
const { contactLimiter } = require('../middleware/rateLimiter');
const { sendMail, contactNotifyTemplate, contactAckTemplate } = require('../utils/mailer');

const router = express.Router();

// ช่องข้อมูลติดต่อที่แอดมินตั้งค่าได้ (ใช้ร่วมกับ routes/admin.js)
const CONTACT_FIELDS = ['shop_name', 'phone', 'line_id', 'line_url', 'email', 'facebook_url', 'address', 'hours', 'note'];

async function getContactSettings() {
  const [rows] = await pool.query('SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?)', [CONTACT_FIELDS]);
  const out = {};
  CONTACT_FIELDS.forEach(k => { out[k] = ''; });
  rows.forEach(r => { out[r.setting_key] = r.setting_value || ''; });
  return out;
}

// ถ้ามี token ที่ถูกต้องให้ผูกข้อความกับสมาชิก ถ้าไม่มี/หมดอายุ ก็ส่งแบบไม่ล็อกอินได้
function optionalUser(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try { return jwt.verify(header.split(' ')[1], SECRET); } catch { return null; }
}

// ข้อมูลติดต่อของร้าน (สาธารณะ — ไม่ต้องล็อกอิน)
router.get('/info', async (req, res) => {
  try {
    res.json(await getContactSettings());
  } catch (err) {
    console.error(err);
    // ยังไม่ได้รัน migration v9 ก็ยังเปิดหน้าได้ แค่ไม่มีข้อมูลร้านให้แสดง
    res.json(Object.fromEntries(CONTACT_FIELDS.map(k => [k, ''])));
  }
});

const clean = (v, max) => String(v || '').trim().slice(0, max);

// ส่งข้อความหาเจ้าหน้าที่
router.post('/messages', contactLimiter, async (req, res) => {
  try {
    const name = clean(req.body.name, 100);
    const email = clean(req.body.email, 150);
    const phone = clean(req.body.phone, 20).replace(/[^\d+\-\s]/g, '') || null;
    const subject = clean(req.body.subject, 120);
    const message = clean(req.body.message, 2000);
    if (!name || !subject || !message) return res.status(400).json({ message: 'กรุณากรอกชื่อ หัวข้อ และข้อความให้ครบ' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'รูปแบบอีเมลไม่ถูกต้อง เจ้าหน้าที่จะใช้อีเมลนี้ตอบกลับ' });
    if (message.length < 10) return res.status(400).json({ message: 'กรุณาอธิบายรายละเอียดอย่างน้อย 10 ตัวอักษร' });

    const user = optionalUser(req);
    let recordId = null;
    if (user && req.body.borrow_record_id) {
      // รับเฉพาะรายการยืมที่เป็นของสมาชิกคนนี้เอง
      const [[rec]] = await pool.query('SELECT id FROM borrow_records WHERE id = ? AND user_id = ?', [Number(req.body.borrow_record_id), user.id]);
      recordId = rec ? rec.id : null;
    }

    const [result] = await pool.query(
      `INSERT INTO contact_messages (user_id, name, email, phone, subject, message, borrow_record_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user ? user.id : null, name, email, phone, subject, message, recordId]);

    // แจ้งเจ้าหน้าที่ + ตอบรับลูกค้า (ส่งเบื้องหลัง ไม่ให้ลูกค้ารอหรือเจอ error ถ้าอีเมลมีปัญหา)
    notifyStaff({ id: result.insertId, name, email, phone, subject, message, borrow_record_id: recordId })
      .catch(err => console.error('[contact] แจ้งเจ้าหน้าที่ไม่สำเร็จ:', err.message));
    sendMail(email, 'เราได้รับข้อความของคุณแล้ว - RP Bookstore', contactAckTemplate(name, subject))
      .catch(err => console.error('[contact] ส่งอีเมลตอบรับไม่สำเร็จ:', err.message));

    res.status(201).json({ message: 'ส่งข้อความเรียบร้อยแล้ว เจ้าหน้าที่จะตอบกลับทางอีเมลที่คุณระบุ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถส่งข้อความได้ กรุณาลองใหม่อีกครั้ง' });
  }
});

async function notifyStaff(msg) {
  const settings = await getContactSettings();
  let to = (process.env.CONTACT_NOTIFY_EMAIL || settings.email || '').trim();
  const recipients = [];
  if (to) recipients.push(to);
  else {
    const [admins] = await pool.query("SELECT email FROM users WHERE role = 'admin' AND email NOT LIKE '%@bookshop.local' LIMIT 3");
    admins.forEach(a => recipients.push(a.email));
  }
  for (const r of recipients) {
    await sendMail(r, `[ข้อความใหม่] ${msg.subject}`, contactNotifyTemplate(msg));
  }
}

// ข้อความของฉันและคำตอบจากเจ้าหน้าที่ (ต้องล็อกอิน)
router.get('/my', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, subject, message, status, admin_reply, replied_at, created_at, borrow_record_id
       FROM contact_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

module.exports = router;
module.exports.CONTACT_FIELDS = CONTACT_FIELDS;
module.exports.getContactSettings = getContactSettings;
