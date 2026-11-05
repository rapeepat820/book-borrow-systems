// ============================================================
// ตรรกะคำนวณหลักของระบบ: กำหนดวันคืน / ค่าจัดส่ง / ค่ามัดจำ
// ============================================================

/**
 * คำนวณวันครบกำหนดคืน
 * (ข้อ 1: ระยะเวลาจัดส่งมีผลต่อระยะเวลายืม-คืน)
 * (ข้อ 4: ระยะเวลายืมแปรผันตามประเภทหนังสือ)
 *
 * due_date = borrow_date + book_type.borrow_days + shipping.delivery_days(ไป) + shipping.delivery_days(กลับ)
 * หมายเหตุ: คิดเวลาจัดส่งทั้งขาไปและขากลับ เพราะลูกค้าต้องได้ครองหนังสือครบตามสิทธิ์ borrow_days จริง
 */
function calcDueDate(borrowDate, borrowDays, shippingDeliveryDays) {
  const date = new Date(borrowDate);
  const totalDays = Number(borrowDays) + Number(shippingDeliveryDays) * 2;
  date.setDate(date.getDate() + totalDays);
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

// น้ำหนักบรรจุภัณฑ์ต่อพัสดุ (กรัม) — บวกเพิ่มจากน้ำหนักหนังสือทั้งหมดเสมอ (ปรับได้ด้วยตัวแปร env PACKAGING_WEIGHT_G)
const PACKAGING_WEIGHT_G = (() => {
  const n = Number(process.env.PACKAGING_WEIGHT_G);
  return process.env.PACKAGING_WEIGHT_G && Number.isFinite(n) && n >= 0 ? n : 100;
})();

// จำนวนเล่มสูงสุดต่อ 1 ออเดอร์ (ปรับได้ด้วย env MAX_BOOKS_PER_ORDER)
const MAX_BOOKS_PER_ORDER = (() => {
  const n = Number(process.env.MAX_BOOKS_PER_ORDER);
  return process.env.MAX_BOOKS_PER_ORDER && Number.isInteger(n) && n >= 1 ? n : 5;
})();

/**
 * น้ำหนักพัสดุรวม (กรัม) = น้ำหนักหนังสือทุกเล่ม + บรรจุภัณฑ์
 */
function calcTotalWeight(books) {
  const booksWeight = books.reduce((sum, b) => sum + (Number(b.weight_g) > 0 ? Number(b.weight_g) : 300), 0);
  return booksWeight + PACKAGING_WEIGHT_G;
}

/**
 * คำนวณค่าจัดส่งตามน้ำหนักจริง
 * shipping_fee = base_fee (ครอบคลุมน้ำหนักไม่เกิน base_weight_g)
 *              + fee_per_extra_kg × (จำนวน กก. ที่เกิน ปัดขึ้นเป็นกิโลเต็ม)
 */
function calcShippingFeeByWeight(shippingCompany, totalWeightG) {
  const baseWeight = Number(shippingCompany.base_weight_g) > 0 ? Number(shippingCompany.base_weight_g) : 1000;
  const extraKg = Math.ceil(Math.max(Number(totalWeightG) - baseWeight, 0) / 1000);
  return Math.round((Number(shippingCompany.base_fee) + Number(shippingCompany.fee_per_extra_kg || 0) * extraKg) * 100) / 100;
}

/**
 * แบ่งค่าส่งรวมให้แต่ละเล่มตามสัดส่วนน้ำหนัก (ผลรวมเท่าค่าส่งรวมเป๊ะ เศษสตางค์ให้เล่มแรก)
 */
function splitShippingFee(totalFee, books) {
  const weights = books.map(b => (Number(b.weight_g) > 0 ? Number(b.weight_g) : 300));
  const sumW = weights.reduce((a, c) => a + c, 0);
  const parts = weights.map(w => Math.floor((Number(totalFee) * w / sumW) * 100) / 100);
  const remainder = Math.round((Number(totalFee) - parts.reduce((a, c) => a + c, 0)) * 100) / 100;
  parts[0] = Math.round((parts[0] + remainder) * 100) / 100;
  return parts;
}

/**
 * คำนวณค่ามัดจำ = 20% ของมูลค่าหนังสือ (ปัดขึ้นเป็นหลักสิบบาท ขั้นต่ำ 10 บาท) — เป็นการยืม-คืน ไม่ใช่การซื้อ
 * จึงไม่เรียกเก็บเต็มราคาเพื่อไม่ให้หนังสือราคาสูงไม่มีคนยืม (ปรับ % ได้ด้วยตัวแปร env DEPOSIT_PERCENT)
 * ถ้าหนังสือไม่ได้ระบุมูลค่า จะใช้ค่ามัดจำมาตรฐานของประเภทหนังสือแทน
 */
const DEPOSIT_PERCENT = Math.min(envNumber('DEPOSIT_PERCENT', 20), 100);
function calcDeposit(bookType, book) {
  const value = Number(book.price_value || 0);
  if (value > 0) {
    return Math.max(Math.ceil((value * DEPOSIT_PERCENT) / 100 / 10) * 10, 10);
  }
  return Number(bookType.deposit_amount || 0);
}

// ค่าธรรมเนียมต่ออายุยืม (บาทต่อวันที่ขอต่อ) — ลูกค้าต้องชำระก่อนคำขอจึงจะมีผลกับกำหนดคืนจริง


/**
 * ค่าธรรมเนียมต่ออายุยืม 1 ครั้ง = เท่ากับค่ามัดจำของหนังสือเล่มนั้น
 * (ต่ออายุได้เพิ่มเท่าระยะเวลายืมปกติของประเภทหนังสือนั้น)
 */
function calcExtendFee(depositAmount) {
  return Number(depositAmount) || 0;
}

// ------------------------------------------------------------
// ค่าปรับเกินกำหนดคืน (ปรับค่าได้ผ่านตัวแปร env ใน Railway)
//   LATE_FEE_PER_DAY    = บาทต่อวันที่เกินกำหนด (ค่าเริ่มต้น 10)
//   LATE_FEE_GRACE_DAYS = จำนวนวันที่ผ่อนผันก่อนเริ่มนับค่าปรับ (ค่าเริ่มต้น 0)
// ค่าปรับรวมไม่เกินค่ามัดจำของรายการนั้น (เลยจากนั้นแอดมินต้องจัดการเอง เช่น กรณีหนังสือสูญหาย)
// ------------------------------------------------------------
function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
const LATE_FEE_PER_DAY = envNumber('LATE_FEE_PER_DAY', 10);
const LATE_FEE_GRACE_DAYS = envNumber('LATE_FEE_GRACE_DAYS', 0);

function calcLateFee(lateDays, depositAmount) {
  const fee = Math.max(Number(lateDays) || 0, 0) * LATE_FEE_PER_DAY;
  return Math.round(Math.min(fee, Number(depositAmount) || 0) * 100) / 100;
}

// SQL ที่ใช้นับจำนวนวันเกินกำหนดดิบ (ก่อนหักวันผ่อนผัน): นับถึงวันที่ลูกค้าแจ้งคืน (return_date) ถ้าแจ้งแล้ว ไม่งั้นนับถึงวันนี้
// ใช้วันที่แจ้งคืน ไม่ใช่วันที่แอดมินกดยืนยัน เพื่อไม่ให้ลูกค้าโดนปรับเพราะแอดมินตรวจช้า
const LATE_DAYS_SQL = 'GREATEST(DATEDIFF(COALESCE(br.return_date, CURDATE()), br.due_date), 0) AS late_days_raw';

// เติมข้อมูลค่าปรับลงในแถวรายการยืม (ต้อง SELECT LATE_DAYS_SQL มาด้วย)
function attachLateInfo(row) {
  const counts = ['borrowing', 'return_requested', 'returned', 'overdue'].includes(row.status);
  const rawDays = counts ? Number(row.late_days_raw || 0) : 0;
  const lateDays = Math.max(rawDays - LATE_FEE_GRACE_DAYS, 0);
  const accrued = calcLateFee(lateDays, row.deposit_amount);
  return {
    ...row,
    is_overdue: row.status === 'borrowing' && rawDays > 0,
    late_days: lateDays,
    late_fee_per_day: LATE_FEE_PER_DAY,
    // รายการที่คืนแล้วใช้ยอดที่หักจริงตอนยืนยัน ที่เหลือใช้ยอดสะสมล่าสุด
    late_fee_due: row.status === 'returned' ? Number(row.late_fee || 0) : accrued
  };
}

module.exports = {
  calcDueDate, calcDeposit, calcExtendFee, DEPOSIT_PERCENT,
  LATE_FEE_PER_DAY, LATE_FEE_GRACE_DAYS, calcLateFee, LATE_DAYS_SQL, attachLateInfo,
  PACKAGING_WEIGHT_G, MAX_BOOKS_PER_ORDER, calcTotalWeight, calcShippingFeeByWeight, splitShippingFee
};
