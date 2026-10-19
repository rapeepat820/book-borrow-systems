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

module.exports = { authLimiter };
