// ตั้งค่า Cloudinary สำหรับเก็บรูปภาพ (สลิปโอนเงิน / หลักฐานการคืนหนังสือ) แบบถาวร
// จำเป็นสำหรับการ deploy จริง เพราะพื้นที่เก็บไฟล์ของ hosting อย่าง Railway เป็นแบบชั่วคราว (ephemeral)
// ไฟล์ที่อัปโหลดไว้จะหายไปทุกครั้งที่ redeploy ถ้าไม่เก็บไว้ที่บริการภายนอกแบบนี้
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

module.exports = cloudinary;
