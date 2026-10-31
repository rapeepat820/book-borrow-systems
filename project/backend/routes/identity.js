// ยืนยันตัวตนสมาชิก (ฝั่งลูกค้า): ส่งเลขบัตร + รูปบัตร + เซลฟี่ถือบัตร / ดูสถานะ
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const identityUpload = require('../middleware/identityUpload');
const { IdentityError, prepareSubmission, saveSubmission } = require('../utils/identity');

const router = express.Router();
router.use(requireAuth);

router.get('/status', async (req, res) => {
  try {
    const [[u]] = await pool.query('SELECT id_verify_status, id_reject_reason, national_id_last4 FROM users WHERE id = ?', [req.user.id]);
    res.json({ status: u.id_verify_status, reject_reason: u.id_reject_reason, last4: u.national_id_last4, required: process.env.REQUIRE_ID_VERIFICATION !== 'false' });
  } catch (err) {
    res.json({ status: 'verified', reject_reason: null, required: false }); // ยังไม่ได้รัน migration v11
  }
});

router.post('/submit', authLimiter, identityUpload, async (req, res) => {
  try {
    const [[u]] = await pool.query('SELECT id_verify_status FROM users WHERE id = ?', [req.user.id]);
    if (u.id_verify_status === 'verified') return res.status(400).json({ message: 'บัญชีของคุณยืนยันตัวตนแล้ว' });
    if (u.id_verify_status === 'pending') return res.status(400).json({ message: 'คุณส่งข้อมูลไว้แล้ว กำลังรอแอดมินตรวจสอบ' });
    const prepared = await prepareSubmission({ idNumber: req.body.id_number, files: req.files, consent: req.body.consent, excludeUserId: req.user.id });
    await saveSubmission(req.user.id, prepared);
    res.status(201).json({ message: 'ส่งข้อมูลยืนยันตัวตนเรียบร้อย รอแอดมินตรวจสอบ' });
  } catch (err) {
    if (err instanceof IdentityError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถส่งข้อมูลยืนยันตัวตนได้' });
  }
});

module.exports = router;
