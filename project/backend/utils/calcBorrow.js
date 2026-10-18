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

module.exports = { calcDueDate, calcShippingFee, calcDeposit, calcExtendFee, EXTEND_FEE_PER_DAY };
