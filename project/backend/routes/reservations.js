// จองคิวหนังสือที่ถูกยืมหมด (ลูกค้า)
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const requireVerified = require('../middleware/requireVerified');
const { HOLD_HOURS, MAX_ACTIVE_RESERVATIONS, heldCopies, promoteReservations } = require('../utils/reservations');

const router = express.Router();
router.use(requireAuth);

// สถานะของหนังสือเล่มนี้สำหรับผู้ใช้คนนี้ (ใช้ตัดสินว่าหน้าหนังสือจะแสดงปุ่ม ยืม / จองคิว / ยกเลิกการจอง)
router.get('/status/:bookId', async (req, res) => {
  try {
    const [[book]] = await pool.query('SELECT id, available_copies FROM books WHERE id = ?', [req.params.bookId]);
    if (!book) return res.status(404).json({ message: 'ไม่พบหนังสือ' });
    const heldForOthers = await heldCopies(pool, book.id, req.user.id);
    const [[mine]] = await pool.query(
      "SELECT id, status, expires_at, created_at FROM book_reservations WHERE user_id = ? AND book_id = ? AND status IN ('waiting','ready') ORDER BY id DESC LIMIT 1",
      [req.user.id, book.id]);
    const [[q]] = await pool.query("SELECT COUNT(*) AS n FROM book_reservations WHERE book_id = ? AND status = 'waiting'", [book.id]);
    let position = null;
    if (mine && mine.status === 'waiting') {
      const [[p]] = await pool.query(
        "SELECT COUNT(*) AS n FROM book_reservations WHERE book_id = ? AND status = 'waiting' AND (created_at < ? OR (created_at = ? AND id < ?))",
        [book.id, mine.created_at, mine.created_at, mine.id]);
      position = Number(p.n) + 1;
    }
    res.json({
      available_copies: book.available_copies,
      can_borrow_now: Number(book.available_copies) - heldForOthers >= 1 || !!(mine && mine.status === 'ready'),
      my_reservation: mine ? { ...mine, position } : null,
      queue_length: Number(q.n),
      hold_hours: HOLD_HOURS
    });
  } catch (err) {
    console.error(err);
    // ยังไม่ได้รัน migration v10 → ไม่ให้หน้าหนังสือพัง
    res.json({ available_copies: null, can_borrow_now: true, my_reservation: null, queue_length: 0, hold_hours: HOLD_HOURS, unavailable: true });
  }
});

// จองคิว (ทำได้เฉพาะเมื่อ "เราเอง" ยังยืมเล่มนี้ไม่ได้ตอนนี้)
router.post('/', requireVerified, async (req, res) => {
  try {
    const bookId = Number(req.body.book_id);
    const [[book]] = await pool.query('SELECT id, title, available_copies FROM books WHERE id = ?', [bookId]);
    if (!book) return res.status(404).json({ message: 'ไม่พบหนังสือ' });

    const heldForOthers = await heldCopies(pool, book.id, req.user.id);
    if (Number(book.available_copies) - heldForOthers >= 1) {
      return res.status(400).json({ message: 'หนังสือเล่มนี้ยังมีเล่มว่าง ยืมได้เลยโดยไม่ต้องจองคิว' });
    }
    const [[dup]] = await pool.query(
      "SELECT id FROM book_reservations WHERE user_id = ? AND book_id = ? AND status IN ('waiting','ready')", [req.user.id, bookId]);
    if (dup) return res.status(400).json({ message: 'คุณจองคิวหนังสือเล่มนี้ไว้แล้ว' });
    const [[holding]] = await pool.query(
      "SELECT id FROM borrow_records WHERE user_id = ? AND book_id = ? AND status <> 'returned'", [req.user.id, bookId]);
    if (holding) return res.status(400).json({ message: 'คุณกำลังยืมหนังสือเล่มนี้อยู่ จึงจองคิวซ้ำไม่ได้' });
    const [[active]] = await pool.query(
      "SELECT COUNT(*) AS n FROM book_reservations WHERE user_id = ? AND status IN ('waiting','ready')", [req.user.id]);
    if (Number(active.n) >= MAX_ACTIVE_RESERVATIONS) {
      return res.status(400).json({ message: `จองคิวพร้อมกันได้สูงสุด ${MAX_ACTIVE_RESERVATIONS} เล่ม` });
    }

    const [result] = await pool.query('INSERT INTO book_reservations (user_id, book_id) VALUES (?, ?)', [req.user.id, bookId]);
    res.status(201).json({ id: result.insertId, message: 'จองคิวสำเร็จ เมื่อมีเล่มว่างเราจะแจ้งทางอีเมลและกันเล่มไว้ให้คุณ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถจองคิวได้ (ลองรัน migration v10 แล้วหรือยัง)' });
  }
});

// การจองของฉัน
router.get('/my', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.book_id, r.status, r.created_at, r.notified_at, r.expires_at, b.title, b.cover_image,
              (SELECT COUNT(*) FROM book_reservations x WHERE x.book_id = r.book_id AND x.status = 'waiting'
                 AND (x.created_at < r.created_at OR (x.created_at = r.created_at AND x.id < r.id))) + 1 AS position
       FROM book_reservations r JOIN books b ON r.book_id = b.id
       WHERE r.user_id = ? AND (r.status IN ('waiting','ready') OR r.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY))
       ORDER BY FIELD(r.status, 'ready', 'waiting', 'fulfilled', 'expired', 'cancelled'), r.created_at DESC`, [req.user.id]);
    res.json({ items: rows, hold_hours: HOLD_HOURS });
  } catch (err) {
    console.error(err);
    res.json({ items: [], hold_hours: HOLD_HOURS });
  }
});

// ยกเลิกการจอง
router.delete('/:id', async (req, res) => {
  try {
    const [[r]] = await pool.query("SELECT * FROM book_reservations WHERE id = ? AND user_id = ? AND status IN ('waiting','ready')", [req.params.id, req.user.id]);
    if (!r) return res.status(404).json({ message: 'ไม่พบการจองที่ยกเลิกได้' });
    await pool.query("UPDATE book_reservations SET status = 'cancelled' WHERE id = ?", [r.id]);
    if (r.status === 'ready') await promoteReservations(r.book_id); // ส่งต่อสิทธิ์ให้คนถัดไป
    res.json({ message: 'ยกเลิกการจองแล้ว' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถยกเลิกการจองได้' });
  }
});

module.exports = router;
