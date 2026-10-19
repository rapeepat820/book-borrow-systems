const express = require('express');
const pool = require('../config/db');
const router = express.Router();

// ค้นหา/แสดงรายการหนังสือทั้งหมด (public - ใช้ในหน้า Home)
router.get('/', async (req, res) => {
  try {
    const { search, type } = req.query;
    let sql = `SELECT b.*, bt.type_name, bt.borrow_days, bt.deposit_amount AS type_deposit
               FROM books b JOIN book_types bt ON b.book_type_id = bt.id WHERE 1=1`;
    const params = [];
    if (search) {
      sql += ' AND (b.title LIKE ? OR b.author LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (type) {
      sql += ' AND b.book_type_id = ?';
      params.push(type);
    }
    sql += ' ORDER BY b.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ไม่สามารถโหลดรายการหนังสือได้' });
  }
});

// รายละเอียดหนังสือเล่มเดียว
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, bt.type_name, bt.borrow_days, bt.deposit_amount AS type_deposit
       FROM books b JOIN book_types bt ON b.book_type_id = bt.id WHERE b.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'ไม่พบหนังสือ' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// รายการประเภทหนังสือทั้งหมด (ใช้ทำ filter dropdown)
router.get('/meta/types', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM book_types');
  res.json(rows);
});

// รายชื่อบริษัทขนส่งที่เปิดใช้งาน (ใช้ตอนลูกค้าเลือกวิธีจัดส่งก่อนยืม)
router.get('/meta/shipping-companies', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM shipping_companies WHERE is_active = 1');
  res.json(rows);
});

module.exports = router;
