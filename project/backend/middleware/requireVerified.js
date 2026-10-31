// ต้องผ่านการยืนยันตัวตน (แอดมินอนุมัติแล้ว) ก่อนยืม/จองหนังสือ — ปิดได้ด้วย REQUIRE_ID_VERIFICATION=false
const pool = require('../config/db');

const MESSAGES = {
  unverified: 'กรุณายืนยันตัวตนก่อนยืมหนังสือ (กรอกเลขบัตรประชาชน แนบรูปบัตรและรูปเซลฟี่ถือบัตร)',
  pending: 'บัญชีของคุณกำลังรอแอดมินตรวจสอบการยืนยันตัวตน เมื่ออนุมัติแล้วจะยืมหนังสือได้ทันที',
  rejected: 'การยืนยันตัวตนไม่ผ่าน กรุณาส่งข้อมูลยืนยันตัวตนใหม่อีกครั้ง'
};

module.exports = async function requireVerified(req, res, next) {
  if (process.env.REQUIRE_ID_VERIFICATION === 'false') return next();
  try {
    const [[u]] = await pool.query('SELECT role, id_verify_status, id_reject_reason FROM users WHERE id = ?', [req.user.id]);
    if (!u) return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้' });
    if (u.role === 'admin' || u.id_verify_status === 'verified') return next();
    const reason = u.id_verify_status === 'rejected' && u.id_reject_reason ? ` (เหตุผล: ${u.id_reject_reason})` : '';
    return res.status(403).json({ code: 'ID_VERIFICATION_REQUIRED', status: u.id_verify_status, message: (MESSAGES[u.id_verify_status] || MESSAGES.unverified) + reason });
  } catch (err) {
    // ยังไม่ได้รัน migration v11 → ไม่ล็อกการยืมของทุกคน แต่บันทึกไว้ให้แอดมินรู้
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      console.error('[identity] ยังไม่ได้รัน migration v11 จึงข้ามการตรวจยืนยันตัวตน');
      return next();
    }
    next(err);
  }
};
