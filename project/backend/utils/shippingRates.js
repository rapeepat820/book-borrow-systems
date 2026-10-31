// คำนวณค่าส่ง: เลือกกล่องตามขนาด/น้ำหนักหนังสือ → ขอราคาจากขนส่ง (API จริง หรือตารางราคาของร้าน)
//   rate_provider = 'flash'  → ขอราคาจริงจาก Flash Express (POST /open/v1/orders/estimate_rate) ต้องมี FLASH_MCH_ID + FLASH_SECRET_KEY
//   rate_provider = 'manual' → ใช้ตารางราคาที่แอดมินตั้ง (ค่าเริ่มต้น + ค่าเพิ่มต่อ กก.)
// ถ้า API ใช้ไม่ได้ (ไม่ได้ตั้งค่า / ล่ม / ตอบผิดปกติ) จะถอยไปใช้ตารางราคาของร้านอัตโนมัติ ลูกค้าจึงยังยืมได้
const crypto = require('crypto');
const pool = require('../config/db');
const { calcShippingFeeByWeight } = require('./calcBorrow');

const FLASH_BASE = () => (process.env.FLASH_API_BASE || 'https://open-api.flashexpress.com').replace(/\/$/, '');
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

class ShippingError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// ลายเซ็นตามเอกสาร Flash Express: เรียงชื่อพารามิเตอร์ตาม ASCII → key=value คั่น & (ข้ามค่าว่าง/sign) → ต่อท้าย &key=<secret> → SHA256 ตัวพิมพ์ใหญ่
function flashSign(params, secret) {
  const str = Object.keys(params)
    .filter(k => k !== 'sign' && String(params[k] ?? '').trim() !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha256').update(`${str}&key=${secret}`).digest('hex').toUpperCase();
}

function isFlashConfigured() {
  return !!(process.env.FLASH_MCH_ID && process.env.FLASH_SECRET_KEY);
}

async function getShipFromPostal() {
  try {
    const [[row]] = await pool.query("SELECT setting_value FROM site_settings WHERE setting_key = 'ship_from_postal'");
    if (row && /^\d{5}$/.test(row.setting_value || '')) return row.setting_value;
  } catch (err) { /* ตารางยังไม่มี */ }
  return /^\d{5}$/.test(process.env.SHIP_FROM_POSTAL || '') ? process.env.SHIP_FROM_POSTAL : null;
}

// ขอราคาประเมินจาก Flash Express — คืนค่าเป็นบาท (API ตอบเป็นสตางค์)
async function flashEstimate({ srcPostal, dstPostal, weightG, box }) {
  const params = {
    mchId: process.env.FLASH_MCH_ID,
    nonceStr: String(Date.now()),
    srcPostalCode: srcPostal,
    dstPostalCode: dstPostal,
    weight: String(Math.ceil(weightG)),
    length: String(box.length_cm),
    width: String(box.width_cm),
    height: String(box.height_cm)
  };
  params.sign = flashSign(params, process.env.FLASH_SECRET_KEY);
  const res = await fetch(`${FLASH_BASE()}/open/v1/orders/estimate_rate`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(8000)
  });
  const json = await res.json().catch(() => null);
  const price = json && json.data && Number(json.data.estimatePrice);
  if (!res.ok || !json || String(json.code) !== '1' || !Number.isFinite(price) || price <= 0) {
    throw new Error(`Flash estimate_rate ตอบผิดปกติ (HTTP ${res.status}, code ${json && json.code}: ${json && json.message})`);
  }
  return price / 100;
}

// เลือกกล่องเล็กสุดที่ใส่ได้ทั้งจำนวนเล่มและน้ำหนัก
function pickBox(boxes, books) {
  const n = books.length;
  const weight = books.reduce((s, b) => s + (Number(b.weight_g) > 0 ? Number(b.weight_g) : 300), 0);
  const fit = boxes
    .filter(b => b.is_active && Number(b.max_items) >= n && Number(b.max_book_weight_g) >= weight)
    .sort((a, b) => a.sort_order - b.sort_order || a.max_book_weight_g - b.max_book_weight_g)[0];
  return { box: fit || null, bookWeight: weight };
}

// คืน { box, parcel_weight_g, fee, source, note }
async function getShippingQuote({ company, books, dstPostal }) {
  let boxes;
  try {
    [boxes] = await pool.query('SELECT * FROM shipping_boxes WHERE is_active = 1 ORDER BY sort_order, id');
  } catch (err) {
    boxes = []; // ยังไม่ได้รัน migration v12 → ใช้ค่าเริ่มต้นแบบเดิม
  }
  if (!boxes.length) {
    boxes = [{ id: 0, name: 'กล่องมาตรฐาน', max_items: 99, max_book_weight_g: 99999, length_cm: 30, width_cm: 22, height_cm: 12, packaging_weight_g: 100, is_active: 1, sort_order: 0 }];
  }
  const { box, bookWeight } = pickBox(boxes, books);
  if (!box) {
    throw new ShippingError('จำนวนหรือน้ำหนักหนังสือเกินกว่ากล่องที่ร้านมี กรุณาแบ่งเป็นหลายออเดอร์');
  }
  const parcelWeight = bookWeight + Number(box.packaging_weight_g);
  const manualFee = calcShippingFeeByWeight(company, parcelWeight);
  const out = { box, parcel_weight_g: parcelWeight, fee: manualFee, source: 'manual', note: null };

  if (company.rate_provider === 'flash') {
    const srcPostal = await getShipFromPostal();
    if (!isFlashConfigured() || !srcPostal || !/^\d{5}$/.test(dstPostal || '')) {
      out.source = 'manual_fallback';
      out.note = !isFlashConfigured() ? 'ยังไม่ได้ตั้งค่า API ขนส่ง ใช้ราคาตามตารางของร้าน'
        : !srcPostal ? 'ยังไม่ได้ตั้งรหัสไปรษณีย์ต้นทางของร้าน ใช้ราคาตามตารางของร้าน'
        : 'ที่อยู่ของคุณไม่มีรหัสไปรษณีย์ 5 หลัก ใช้ราคาประมาณการตามตารางของร้าน';
      return out;
    }
    const key = `flash|${srcPostal}|${dstPostal}|${parcelWeight}|${box.length_cm}x${box.width_cm}x${box.height_cm}`;
    const hit = cache.get(key);
    let base;
    if (hit && Date.now() - hit.t < CACHE_MS) {
      base = hit.v;
    } else {
      try {
        base = await flashEstimate({ srcPostal, dstPostal, weightG: parcelWeight, box });
        cache.set(key, { v: base, t: Date.now() });
      } catch (err) {
        console.error('[shipping] ขอราคา Flash ไม่สำเร็จ ใช้ราคาตามตารางแทน:', err.message);
        out.source = 'manual_fallback';
        out.note = 'ขอราคาจากขนส่งไม่สำเร็จ ใช้ราคาประมาณการตามตารางของร้าน';
        return out;
      }
    }
    const markup = Number(company.markup_percent) || 0;
    out.fee = Math.round(base * (1 + markup / 100) * 100) / 100;
    out.source = 'flash';
  }
  return out;
}

module.exports = { ShippingError, flashSign, isFlashConfigured, getShippingQuote, pickBox };
