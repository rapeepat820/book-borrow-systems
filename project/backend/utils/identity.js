// ส่งและตรวจคำขอยืนยันตัวตน: ตรวจเลขบัตร → ย่อ/ล้างข้อมูลแฝงในรูป → เข้ารหัส → เก็บรอแอดมินตรวจ
const sharp = require('sharp');
const pool = require('../config/db');
const { encrypt, hashId, isValidThaiId } = require('./idCrypto');

class IdentityError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const digits = v => String(v || '').replace(/\D/g, '');

// ย่อรูปไม่เกิน 1280px แล้วแปลงเป็น JPEG ใหม่ (ลบข้อมูล EXIF/GPS ออกทั้งหมด และกันไฟล์ที่ไม่ใช่รูปจริง)
async function cleanImage(buffer, label) {
  try {
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    if (!meta.width || meta.width < 300 || meta.height < 300) throw new IdentityError(`${label}ความละเอียดต่ำเกินไป กรุณาถ่ายให้ชัดและใกล้ขึ้น`);
    return await sharp(buffer, { failOn: 'none' }).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
  } catch (err) {
    if (err instanceof IdentityError) throw err;
    throw new IdentityError(`${label}ไม่ใช่ไฟล์รูปที่เปิดได้ กรุณาเลือกรูปใหม่`);
  }
}

// ตรวจข้อมูลที่ส่งมา (ยังไม่แตะฐานข้อมูลของคำขอ) — เรียกก่อนสร้างบัญชีตอนสมัคร เพื่อไม่ให้เกิดบัญชีค้างถ้าข้อมูลไม่ครบ
async function prepareSubmission({ idNumber, files, consent, excludeUserId = null }) {
  const id = digits(idNumber);
  if (!isValidThaiId(id)) throw new IdentityError('เลขบัตรประชาชนไม่ถูกต้อง (ต้องมี 13 หลักและผ่านการตรวจเลขท้าย)');
  if (!(consent === true || consent === 'true' || consent === 'on' || consent === '1')) {
    throw new IdentityError('กรุณายินยอมให้เก็บและใช้ข้อมูลเพื่อยืนยันตัวตน');
  }
  const card = files && files.id_card_image && files.id_card_image[0];
  const selfie = files && files.selfie_image && files.selfie_image[0];
  if (!card) throw new IdentityError('กรุณาแนบรูปถ่ายบัตรประชาชน');
  if (!selfie) throw new IdentityError('กรุณาแนบรูปเซลฟี่ถือบัตรประชาชนของคุณ');

  const idHash = hashId(id);
  const [[taken]] = await pool.query(
    'SELECT id FROM users WHERE national_id_hash = ? AND id <> ?', [idHash, excludeUserId || 0]);
  if (taken) throw new IdentityError('เลขบัตรประชาชนนี้ถูกยืนยันกับบัญชีอื่นแล้ว หากคุณเป็นเจ้าของตัวจริง กรุณาติดต่อเจ้าหน้าที่', 409);

  return {
    idHash, last4: id.slice(-4), idEnc: encrypt(id),
    cardImg: encrypt(await cleanImage(card.buffer, 'รูปบัตรประชาชน')),
    selfieImg: encrypt(await cleanImage(selfie.buffer, 'รูปเซลฟี่'))
  };
}

// บันทึกคำขอที่ผ่านการตรวจแล้ว ให้สถานะผู้ใช้เป็น "รอตรวจสอบ"
async function saveSubmission(userId, prepared) {
  const [[pending]] = await pool.query("SELECT id FROM id_verifications WHERE user_id = ? AND status = 'pending'", [userId]);
  if (pending) throw new IdentityError('คุณส่งข้อมูลยืนยันตัวตนไว้แล้ว กำลังรอแอดมินตรวจสอบ');
  await pool.query(
    `INSERT INTO id_verifications (user_id, id_hash, id_last4, id_number_enc, id_card_image, selfie_image)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, prepared.idHash, prepared.last4, prepared.idEnc, prepared.cardImg, prepared.selfieImg]);
  await pool.query("UPDATE users SET id_verify_status = 'pending', id_reject_reason = NULL WHERE id = ?", [userId]);
}

module.exports = { IdentityError, prepareSubmission, saveSubmission };
