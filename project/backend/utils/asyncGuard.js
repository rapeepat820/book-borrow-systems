// ให้ Express 4 จับข้อผิดพลาดของฟังก์ชัน async อัตโนมัติ (แทนที่จะปล่อยให้โปรเซสล่มทั้งเซิร์ฟเวอร์)
// เช่น ฐานข้อมูลตอบ error ในเส้นทางที่ไม่ได้ครอบ try/catch ไว้ — ตอนนี้จะตอบ 500 ให้ผู้ใช้แล้วเซิร์ฟเวอร์ยังทำงานต่อ
// ต้อง require ไฟล์นี้ "ก่อน" โหลดไฟล์ routes ใดๆ
const Layer = require('express/lib/router/layer');

const original = Layer.prototype.handle_request;
Layer.prototype.handle_request = function handleRequest(req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return next(); // เป็น error-handling middleware ปล่อยตามเดิม
  try {
    const result = fn(req, res, next);
    if (result && typeof result.catch === 'function') result.catch(next);
  } catch (err) {
    next(err);
  }
};
Layer.prototype.handle_request.original = original;
