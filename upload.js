const multer = require('multer');
const path = require('path');

// ใช้ Cloudinary เก็บไฟล์แบบถาวรถ้าตั้งค่าไว้ครบ (จำเป็นสำหรับ production/deploy จริง)
// ถ้ายังไม่ได้ตั้งค่า (เช่น กำลังพัฒนาบนเครื่องตัวเอง) จะเก็บไฟล์ไว้ในดิสก์เครื่องแทนโดยอัตโนมัติ —
// สะดวกสำหรับ dev แต่ **ไม่ถาวรบน hosting ที่ใช้พื้นที่เก็บไฟล์ชั่วคราวอย่าง Railway**
const useCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

function fileFilter(req, file, cb) {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('รองรับเฉพาะไฟล์รูปภาพ (jpg, jpeg, png, webp)'));
}

function makeUploader(subfolder) {
  if (useCloudinary) {
    const cloudinary = require('../config/cloudinary');
    const { CloudinaryStorage } = require('multer-storage-cloudinary');
    const storage = new CloudinaryStorage({
      cloudinary,
      params: {
        folder: `book-borrow/${subfolder}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
      }
    });
    return multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
  }

  // fallback: เก็บไฟล์ไว้ที่ /uploads/<subfolder> บนดิสก์ของเครื่อง (dev เท่านั้น)
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '..', 'uploads', subfolder));
    },
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    }
  });
  return multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
}

module.exports = {
  uploadReturnProof: makeUploader('return-proofs'),
  uploadPaymentSlip: makeUploader('payment-slips'),
  uploadExtendSlip: makeUploader('extend-payment-slips'),
  uploadBookCover: makeUploader('book-covers'),
  useCloudinary
};
