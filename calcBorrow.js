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

/**
 * คำนวณค่าจัดส่ง
 * (ข้อ 5: คิดราคาค่าจัดส่งจากบริษัทต้นแบบที่เลือก)
 * shipping_fee = base_fee + fee_per_book * จำนวนเล่ม
 */
function calcShippingFee(shippingCompany, quantity = 1) {
  return Number(shippingCompany.base_fee) + Number(shippingCompany.fee_per_book) * quantity;
}

/**
 * คำนวณค่ามัดจำ
 * (ข้อ 6: ค่ามัดจำป้องกันหนังสือชำรุด/สูญหาย)
 * ใช้ค่ามัดจำมาตรฐานของประเภทหนังสือ แต่ถ้าหนังสือเล่มนั้นมีมูลค่า (price_value) สูงกว่า
 * ให้ใช้มูลค่าหนังสือแทน (กันกรณีหนังสือหายาก/ราคาแพงในประเภทเดียวกัน)
 */
function calcDeposit(bookType, book) {
  const typeDefault = Number(bookType.deposit_amount);
  const bookValue = Number(book.price_value || 0);
  return Math.max(typeDefault, bookValue);
}

// ค่าธรรมเนียมต่ออายุยืม (บาทต่อวันที่ขอต่อ) — ลูกค้าต้องชำระก่อนคำขอจึงจะมีผลกับกำหนดคืนจริง
const EXTEND_FEE_PER_DAY = 5;

/**
 * คำนวณค่าธรรมเนียมต่ออายุยืม
 * extend_fee = จำนวนวันที่ขอต่อ * ค่าธรรมเนียมต่อวัน
 */
function calcExtendFee(extraDays) {
  return Number(extraDays) * EXTEND_FEE_PER_DAY;
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
  calcDueDate, calcShippingFee, calcDeposit, calcExtendFee, EXTEND_FEE_PER_DAY,
  LATE_FEE_PER_DAY, LATE_FEE_GRACE_DAYS, calcLateFee, LATE_DAYS_SQL, attachLateInfo
};
