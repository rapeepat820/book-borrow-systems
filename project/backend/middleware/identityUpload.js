// รับรูปยืนยันตัวตน (รูปบัตร + เซลฟี่ถือบัตร) เก็บในหน่วยความจำชั่วคราว — ไม่เขียนลงดิสก์ ไม่ผ่านโฟลเดอร์ uploads ที่เปิดสาธารณะ
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => (/^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('NOT_IMAGE')))
}).fields([{ name: 'id_card_image', maxCount: 1 }, { name: 'selfie_image', maxCount: 1 }]);

module.exports = function identityUpload(req, res, next) {
  upload(req, res, err => {
    if (!err) return next();
    const message = err.message === 'NOT_IMAGE' ? 'ไฟล์ต้องเป็นรูปภาพเท่านั้น'
      : err.code === 'LIMIT_FILE_SIZE' ? 'รูปแต่ละใบต้องมีขนาดไม่เกิน 8 MB'
      : 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่';
    res.status(400).json({ message });
  });
};
