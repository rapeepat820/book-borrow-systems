// ระบบตรวจสลิปโอนเงินอัตโนมัติ: อ่าน QR บนสลิป → กันสลิปซ้ำ → (ถ้าตั้งค่า SlipOK) ตรวจกับธนาคารจริง
//
// ผลลัพธ์ของ runSlipCheck():
//   outcome = 'auto_verified'   ตรวจกับธนาคารผ่าน ยอดตรง → อนุมัติให้อัตโนมัติ
//   outcome = 'pending_manual'  อ่าน QR ได้ แต่ยังยืนยันยอด/ความจริงไม่ได้ → ส่งให้แอดมินตรวจเอง
//   outcome = 'rejected'        สลิปใช้ไม่ได้ (ไม่มี QR, ซ้ำ, ยอดไม่ตรง ฯลฯ) → ให้ลูกค้าแนบใหม่
const fs = require('fs/promises');
const pool = require('../config/db');
const { decodeQrFromImage, parseSlipPayload } = require('./slipQr');

const SLIP_TIME_TOLERANCE_MS = 12 * 60 * 60 * 1000; // สลิปต้องไม่เก่ากว่าเวลาสร้างรายการเกิน 12 ชม. (เผื่อเขตเวลา)

function isSlipOkConfigured() {
  return !!(process.env.SLIPOK_API_KEY && process.env.SLIPOK_BRANCH_ID);
}

async function getFileBuffer(file, useCloudinary) {
  if (useCloudinary) {
    const res = await fetch(file.path, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`ดาวน์โหลดรูปสลิปไม่สำเร็จ (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFile(file.path);
}

// ลบไฟล์สลิปที่ใช้ไม่ได้ทิ้ง (best effort)
async function discardFile(file, useCloudinary) {
  try {
    if (!file) return;
    if (useCloudinary) {
      if (file.filename) await require('../config/cloudinary').uploader.destroy(file.filename);
    } else if (file.path) {
      await fs.unlink(file.path);
    }
  } catch (err) {
    console.error('[slip] ลบไฟล์สลิปไม่สำเร็จ:', err.message);
  }
}

// จอง transRef ไว้ก่อน เพื่อกันสลิปใบเดียวถูกใช้ซ้ำ (รวมถึงส่งพร้อมกันหลายคำขอ)
async function reserveSlip({ transRef, sendingBank, recordId, purpose, mode }) {
  try {
    await pool.query(
      'INSERT INTO payment_slips (trans_ref, sending_bank, borrow_record_id, purpose, verify_mode) VALUES (?, ?, ?, ?, ?)',
      [transRef, sendingBank, recordId, purpose, mode]);
    return true;
  } catch (err) {
    if (err.code !== 'ER_DUP_ENTRY') throw err;
    // อนุญาตให้ลูกค้าแนบสลิปใบเดิมซ้ำที่รายการเดิมได้ ถ้ายังไม่เคยถูกยืนยันอัตโนมัติ (เช่น แอดมินเพิ่งปฏิเสธเพราะอ่านไม่ชัด)
    const [[row]] = await pool.query('SELECT * FROM payment_slips WHERE trans_ref = ?', [transRef]);
    return !!(row && row.borrow_record_id === recordId && row.purpose === purpose && row.verify_mode === 'qr_only');
  }
}

async function releaseSlip(transRef) {
  await pool.query('DELETE FROM payment_slips WHERE trans_ref = ?', [transRef]).catch(() => {});
}

// เรียก SlipOK (https://slipok.com/api-documentation/check-slip/) ด้วยข้อมูลที่อ่านได้จาก QR
async function callSlipOk(qrData, amount) {
  const res = await fetch(`https://api.slipok.com/api/line/apikey/${process.env.SLIPOK_BRANCH_ID}`, {
    method: 'POST',
    headers: { 'x-authorization': process.env.SLIPOK_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ data: qrData, amount, log: process.env.SLIPOK_LOG === 'true' }),
    signal: AbortSignal.timeout(20000)
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const SLIPOK_REJECT_MESSAGES = {
  1007: 'ไม่พบ QR บนสลิป กรุณาแนบสลิปที่เห็น QR ชัดเจน',
  1008: 'QR นี้ไม่ใช่ QR สำหรับตรวจสอบการโอนเงิน',
  1011: 'ไม่พบรายการโอนนี้ในระบบธนาคาร (สลิปอาจหมดอายุหรือไม่ถูกต้อง)',
  1012: 'สลิปนี้เคยถูกใช้แล้ว กรุณาแนบสลิปใหม่',
  1013: 'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ',
  1014: 'บัญชีผู้รับในสลิปไม่ตรงกับบัญชีของร้าน'
};

async function runSlipCheck({ file, useCloudinary, recordId, purpose, expectedAmount, createdAt }) {
  // 1) อ่าน QR จากรูป
  const buffer = await getFileBuffer(file, useCloudinary);
  let qrText;
  try {
    qrText = await decodeQrFromImage(buffer);
  } catch (err) {
    if (err.code === 'BAD_IMAGE') return { outcome: 'rejected', message: 'ไฟล์รูปไม่ถูกต้อง กรุณาแนบรูปสลิปใหม่' };
    throw err;
  }
  if (!qrText) {
    return {
      outcome: 'rejected',
      message: 'ไม่พบ QR บนสลิป กรุณาแนบรูปสลิปเต็มหน้าจอที่เห็น QR ชัดเจน (อย่าครอปหรือแต่งรูป) หากแอปธนาคารไม่แสดง QR ให้ลองบันทึกสลิปจากปุ่ม "บันทึกภาพ" ในแอป'
    };
  }
  const parsed = parseSlipPayload(qrText);
  if (!parsed.ok) return { outcome: 'rejected', message: parsed.reason };

  // 2) กันสลิปซ้ำ
  const autoMode = isSlipOkConfigured();
  const reserved = await reserveSlip({
    transRef: parsed.transRef, sendingBank: parsed.sendingBank, recordId, purpose, mode: autoMode ? 'auto' : 'qr_only'
  });
  if (!reserved) return { outcome: 'rejected', message: 'สลิปนี้เคยถูกใช้ชำระรายการอื่นแล้ว กรุณาแนบสลิปใหม่' };

  // 3) ยังไม่ได้ตั้งค่าบริการตรวจสลิป → อ่าน QR อย่างเดียว ส่งให้แอดมินยืนยัน (ไม่อนุมัติเองเพราะ QR ไม่มียอดเงิน)
  if (!autoMode) {
    return { outcome: 'pending_manual', transRef: parsed.transRef, message: 'อ่าน QR บนสลิปสำเร็จ รอเจ้าหน้าที่ตรวจสอบยอดเงิน' };
  }

  // 4) ตรวจกับธนาคารผ่าน SlipOK
  let api;
  try {
    api = await callSlipOk(qrText, Number(expectedAmount));
  } catch (err) {
    console.error('[slip] เรียก SlipOK ไม่สำเร็จ:', err.message);
    await pool.query("UPDATE payment_slips SET verify_mode = 'qr_only' WHERE trans_ref = ?", [parsed.transRef]).catch(() => {});
    return { outcome: 'pending_manual', transRef: parsed.transRef, message: 'ระบบตรวจสลิปอัตโนมัติไม่พร้อมใช้งาน รอเจ้าหน้าที่ตรวจสอบ' };
  }

  const body = api.json || {};
  if (!(body.success && body.data && body.data.success)) {
    const code = Number(body.code);
    if (SLIPOK_REJECT_MESSAGES[code]) {
      await releaseSlip(parsed.transRef);
      return { outcome: 'rejected', message: SLIPOK_REJECT_MESSAGES[code] };
    }
    if (code === 1010) { // ธนาคารต้นทางยังไม่พร้อมให้ตรวจ ต้องรอสักครู่
      await releaseSlip(parsed.transRef);
      return { outcome: 'rejected', message: body.message || 'สลิปจากธนาคารนี้ต้องรอสักครู่หลังโอน กรุณาลองใหม่อีกครั้งในอีกไม่กี่นาที' };
    }
    // โควตาหมด/คีย์ผิด/ธนาคารขัดข้อง ฯลฯ → ไม่ใช่ความผิดของลูกค้า ส่งให้แอดมินตรวจเอง
    console.error('[slip] SlipOK ตอบกลับผิดปกติ:', api.status, JSON.stringify(body).slice(0, 300));
    await pool.query("UPDATE payment_slips SET verify_mode = 'qr_only' WHERE trans_ref = ?", [parsed.transRef]).catch(() => {});
    return { outcome: 'pending_manual', transRef: parsed.transRef, message: 'ระบบตรวจสลิปอัตโนมัติไม่พร้อมใช้งาน รอเจ้าหน้าที่ตรวจสอบ' };
  }

  // 5) ตรวจซ้ำฝั่งเราเอง (ไม่เชื่อแค่ผลจาก API): ยอดเงิน / เวลาโอน / ชื่อผู้รับ
  const d = body.data;
  const reject = async message => { await releaseSlip(parsed.transRef); return { outcome: 'rejected', message }; };

  if (Math.abs(Number(d.amount) - Number(expectedAmount)) > 0.005) {
    return reject(`ยอดในสลิป ${Number(d.amount).toLocaleString('th-TH')} บาท ไม่ตรงกับยอดที่ต้องชำระ ${Number(expectedAmount).toLocaleString('th-TH')} บาท`);
  }
  if (createdAt && d.transTimestamp) {
    const paidAt = new Date(d.transTimestamp).getTime();
    if (Number.isFinite(paidAt) && paidAt < new Date(createdAt).getTime() - SLIP_TIME_TOLERANCE_MS) {
      return reject('สลิปนี้โอนก่อนสร้างรายการ กรุณาโอนตามยอดของรายการนี้และแนบสลิปใหม่');
    }
  }
  const keyword = (process.env.SLIP_RECEIVER_KEYWORD || '').trim();
  if (keyword) {
    const names = [d.receiver && d.receiver.displayName, d.receiver && d.receiver.name].filter(Boolean).join(' ');
    if (!names.includes(keyword)) return reject('บัญชีผู้รับในสลิปไม่ตรงกับบัญชีของร้าน');
  }

  await pool.query("UPDATE payment_slips SET amount = ?, verify_mode = 'auto' WHERE trans_ref = ?", [d.amount, parsed.transRef]);
  return { outcome: 'auto_verified', transRef: parsed.transRef, amount: Number(d.amount), message: 'ตรวจสอบสลิปสำเร็จ ชำระเงินเรียบร้อยแล้ว' };
}

module.exports = { runSlipCheck, discardFile, isSlipOkConfigured };
