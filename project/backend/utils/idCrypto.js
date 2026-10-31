// เข้ารหัส/แฮชข้อมูลยืนยันตัวตน (เลขบัตรประชาชน รูปบัตร เซลฟี่) — AES-256-GCM + HMAC-SHA256
// กุญแจมาจากตัวแปร ID_ENCRYPTION_KEY (แนะนำให้ตั้งค่าแยกใน Railway และ "ห้ามเปลี่ยนภายหลัง" ไม่งั้นรูปที่รอตรวจและแฮชเก่าจะอ่านไม่ได้)
const crypto = require('crypto');
const { SECRET } = require('../middleware/auth');

let keys = null;
function getKeys() {
  if (keys) return keys;
  const raw = process.env.ID_ENCRYPTION_KEY || '';
  if (!raw) {
    console.warn('[identity] ยังไม่ได้ตั้ง ID_ENCRYPTION_KEY — ใช้ค่าที่สร้างจาก JWT_SECRET แทนไปก่อน (แนะนำให้ตั้งค่าแยกใน Railway และอย่าเปลี่ยนภายหลัง)');
  }
  const master = crypto.scryptSync(raw || SECRET, 'rp-bookstore-identity-v1', 32);
  keys = {
    enc: crypto.createHmac('sha256', master).update('enc').digest(),
    mac: crypto.createHmac('sha256', master).update('mac').digest()
  };
  return keys;
}

function encrypt(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKeys().enc, iv);
  const ct = Buffer.concat([cipher.update(Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8')), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]); // 12 + 16 + n ไบต์
}

function decrypt(buf) {
  const d = crypto.createDecipheriv('aes-256-gcm', getKeys().enc, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]);
}

function hashId(idNumber) {
  return crypto.createHmac('sha256', getKeys().mac).update(String(idNumber)).digest('hex');
}

// ตรวจเลขบัตรประชาชนไทย 13 หลักด้วยตัวเลขตรวจสอบหลักที่ 13 (ตรวจรูปแบบเท่านั้น ไม่ได้ยืนยันว่าเลขนี้มีอยู่จริงหรือเป็นของผู้สมัคร)
function isValidThaiId(id) {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

module.exports = { encrypt, decrypt, hashId, isValidThaiId };
