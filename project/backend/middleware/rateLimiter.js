const rateLimit = require('express-rate-limit');

// จำกัดจำนวนครั้งการเรียก endpoint ที่เสี่ยงต่อการโดนโจมตีแบบ brute-force / spam
// (login, register, forgot-password) — ป้องกันบอทลองรหัสผ่านซ้ำๆ หรือสแปมสมัครสมาชิก/ส่งอีเมล
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 20,                   // สูงสุด 20 ครั้งต่อ IP ต่อช่วงเวลา
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'มีการเรียกใช้งานถี่เกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่' }
});

// ฟอร์มติดต่อเจ้าหน้าที่: กันสแปมข้อความ/อีเมล (5 ข้อความต่อชั่วโมงต่อ IP)
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'ส่งข้อความถี่เกินไป กรุณาลองใหม่อีกครั้งในภายหลัง หรือติดต่อผ่านช่องทางอื่นของร้าน' }
});

module.exports = { authLimiter, contactLimiter };
