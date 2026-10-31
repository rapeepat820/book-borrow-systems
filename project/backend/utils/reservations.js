// ระบบจองคิวหนังสือ: เมื่อเล่มถูกยืมหมด ลูกค้าจองคิวได้ พอมีเล่มว่าง (มีคนคืน) ระบบกันเล่มไว้ให้คนแรกในคิว
// และแจ้งทางอีเมล ถ้าไม่มายืมภายในเวลาที่กำหนด สิทธิ์จะหมดอายุและส่งต่อให้คนถัดไป
const pool = require('../config/db');
const { sendMail, reservationReadyTemplate } = require('./mailer');

const HOLD_HOURS = (() => {
  const n = Number(process.env.RESERVATION_HOLD_HOURS);
  return process.env.RESERVATION_HOLD_HOURS && Number.isFinite(n) && n > 0 ? n : 48;
})();
const MAX_ACTIVE_RESERVATIONS = 5; // ต่อสมาชิก 1 คน (รอคิว + กันเล่มไว้ให้)

// จำนวนเล่มที่ถูกกันไว้ให้ผู้จอง (สถานะ ready ที่ยังไม่หมดอายุ) ไม่นับของ exceptUserId
async function heldCopies(db, bookId, exceptUserId = null) {
  const params = [bookId];
  let sql = "SELECT COUNT(*) AS n FROM book_reservations WHERE book_id = ? AND status = 'ready' AND expires_at > NOW()";
  if (exceptUserId) { sql += ' AND user_id <> ?'; params.push(exceptUserId); }
  const [[row]] = await db.query(sql, params);
  return Number(row.n);
}

// จำนวนเล่มที่ "ผู้ใช้คนนี้" ยืมได้จริงตอนนี้ = เล่มว่าง - เล่มที่กันไว้ให้คนอื่น
async function effectiveAvailable(db, book, userId) {
  return Number(book.available_copies) - await heldCopies(db, book.id, userId);
}

// ให้สิทธิ์แก่คนแรกในคิว (ซ้ำจนกว่าเล่มว่างจะหมด หรือคิวหมด)
async function promoteReservations(bookId) {
  let promoted = 0;
  for (let i = 0; i < 20; i++) { // กันลูปไม่รู้จบ
    const [[book]] = await pool.query('SELECT id, title, available_copies FROM books WHERE id = ?', [bookId]);
    if (!book) break;
    const free = Number(book.available_copies) - await heldCopies(pool, bookId);
    if (free <= 0) break;
    const [[next]] = await pool.query(
      `SELECT r.id, r.user_id, u.email, u.full_name
       FROM book_reservations r JOIN users u ON r.user_id = u.id
       WHERE r.book_id = ? AND r.status = 'waiting' ORDER BY r.created_at, r.id LIMIT 1`, [bookId]);
    if (!next) break;
    await pool.query(
      "UPDATE book_reservations SET status = 'ready', notified_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR) WHERE id = ? AND status = 'waiting'",
      [HOLD_HOURS, next.id]);
    promoted++;
    const link = process.env.FRONTEND_URL ? `${String(process.env.FRONTEND_URL).replace(/\/$/, '')}/books/${bookId}` : null;
    sendMail(next.email, `หนังสือที่คุณจองพร้อมให้ยืมแล้ว: ${book.title}`,
      reservationReadyTemplate(next.full_name, book.title, HOLD_HOURS, link))
      .catch(err => console.error('[reservations] ส่งอีเมลแจ้งไม่สำเร็จ:', err.message));
  }
  return promoted;
}

// ตัดสิทธิ์ที่หมดเวลาแล้ว แล้วส่งต่อให้คนถัดไป — เรียกจาก cron ทุกชั่วโมง
async function expireReservations() {
  const [expired] = await pool.query("SELECT id, book_id FROM book_reservations WHERE status = 'ready' AND expires_at <= NOW()");
  if (!expired.length) return 0;
  await pool.query("UPDATE book_reservations SET status = 'expired' WHERE status = 'ready' AND expires_at <= NOW()");
  const bookIds = [...new Set(expired.map(r => r.book_id))];
  for (const id of bookIds) await promoteReservations(id).catch(err => console.error('[reservations] promote error:', err.message));
  return expired.length;
}

// ผู้จองมายืมเล่มนั้นแล้ว → ปิดการจองเป็น fulfilled (เรียกภายในทรานแซกชันของการยืม)
async function fulfillReservation(db, userId, bookId, recordId) {
  await db.query(
    "UPDATE book_reservations SET status = 'fulfilled', fulfilled_record_id = ? WHERE user_id = ? AND book_id = ? AND status IN ('waiting','ready')",
    [recordId, userId, bookId]);
}

module.exports = { HOLD_HOURS, MAX_ACTIVE_RESERVATIONS, heldCopies, effectiveAvailable, promoteReservations, expireReservations, fulfillReservation };
