// อ่านและแยกข้อมูล QR บนสลิปโอนเงินธนาคารไทย (Mini QR สำหรับ Slip Verify API)
// ใช้ sharp แปลงรูป (รองรับ jpg/png/webp + หมุนตาม EXIF) แล้วให้ jsQR ถอดรหัส QR
const sharp = require('sharp');
const jsQR = require('jsqr');

// พื้นที่ที่จะลองหา QR (สัดส่วน left, top, width, height ของภาพ) — เริ่มจากทั้งภาพ แล้วค่อยลองส่วนล่าง/กลาง
// เพราะสลิปส่วนใหญ่วาง QR ไว้ครึ่งล่างและเล็กเมื่อเทียบกับภาพเต็มหน้าจอ
const REGIONS = [
  [0, 0, 1, 1],
  [0, 0.45, 1, 0.55],
  [0.3, 0.45, 0.7, 0.55],
  [0, 0.55, 1, 0.45],
  [0.25, 0.25, 0.5, 0.5],
  [0, 0, 1, 0.5]
];
const TARGET_WIDTHS = [1200, 800];

// jsQR ต้องการข้อมูล RGBA (4 ช่อง/พิกเซล) — แปลงให้ถ้าภาพที่ได้มี 1-3 ช่อง (เช่น หลัง greyscale)
function toRgba(data, info) {
  const { width, height, channels } = info;
  if (channels === 4) return new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += 4) {
    const base = i * channels;
    const r = data[base];
    const g = channels >= 3 ? data[base + 1] : r;
    const b = channels >= 3 ? data[base + 2] : r;
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = 255;
  }
  return out;
}

function decodeRaw(data, info) {
  const result = jsQR(toRgba(data, info), info.width, info.height, { inversionAttempts: 'attemptBoth' });
  return result ? result.data : null;
}

// คืนข้อความใน QR (string) หรือ null ถ้าไม่พบ
async function decodeQrFromImage(buffer) {
  let normalized;
  try {
    normalized = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer({ resolveWithObject: true });
  } catch (err) {
    const e = new Error('ไฟล์รูปไม่ถูกต้อง');
    e.code = 'BAD_IMAGE';
    throw e;
  }
  const { width, height } = normalized.info;

  for (const [l, t, w, h] of REGIONS) {
    const region = {
      left: Math.floor(width * l),
      top: Math.floor(height * t),
      width: Math.max(32, Math.floor(width * w)),
      height: Math.max(32, Math.floor(height * h))
    };
    region.width = Math.min(region.width, width - region.left);
    region.height = Math.min(region.height, height - region.top);

    for (const targetW of TARGET_WIDTHS) {
      for (const enhance of [false, true]) {
        let img = sharp(normalized.data).extract(region).resize({ width: targetW, withoutEnlargement: false });
        if (enhance) img = img.greyscale().normalise().sharpen();
        const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
        const text = decodeRaw(data, info);
        if (text) return text;
      }
    }
  }
  return null;
}

// CRC-16/CCITT-FALSE (ตามมาตรฐาน EMVCo QR) ใช้ตรวจว่า QR ไม่ถูกแก้ไข
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function parseTlv(str) {
  const out = [];
  let i = 0;
  while (i + 4 <= str.length) {
    const tag = str.slice(i, i + 2);
    const len = Number(str.slice(i + 2, i + 4));
    if (!Number.isInteger(len) || i + 4 + len > str.length) return null;
    out.push({ tag, value: str.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return i === str.length ? out : null;
}

// แยกข้อมูลจาก Mini QR ของสลิป: รหัสธนาคารผู้โอน + เลขอ้างอิงรายการ (transRef)
// คืน { ok, sendingBank, transRef, reason }
function parseSlipPayload(payload) {
  const top = parseTlv(String(payload || '').trim());
  if (!top) return { ok: false, reason: 'QR นี้ไม่ใช่ QR บนสลิปโอนเงิน' };

  const crcTag = top.find(t => t.tag === '91');
  if (crcTag) {
    const upToCrc = payload.trim().slice(0, payload.trim().lastIndexOf('9104') + 4);
    if (crc16(upToCrc) !== crcTag.value.toUpperCase()) {
      return { ok: false, reason: 'QR บนสลิปไม่ถูกต้อง (อาจถูกแก้ไข)' };
    }
  }

  const inner = top.find(t => t.tag === '00');
  const sub = inner ? parseTlv(inner.value) : null;
  if (!sub) return { ok: false, reason: 'QR นี้ไม่ใช่ QR บนสลิปโอนเงิน' };

  const sendingBank = (sub.find(t => t.tag === '01') || {}).value;
  const transRef = (sub.find(t => t.tag === '02') || {}).value;
  if (!/^\d{3}$/.test(sendingBank || '') || !transRef || transRef.length < 10) {
    return { ok: false, reason: 'QR นี้ไม่ใช่ QR บนสลิปโอนเงิน' };
  }
  return { ok: true, sendingBank, transRef };
}

module.exports = { decodeQrFromImage, parseSlipPayload, crc16 };
