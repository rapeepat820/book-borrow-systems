// การเชื่อมต่อฐานข้อมูล MySQL ด้วย mysql2 (connection pool)
const mysql = require('mysql2/promise');
require('dotenv').config();

// ฐานข้อมูลบนคลาวด์ส่วนใหญ่ (เช่น TiDB Cloud) บังคับเชื่อมต่อแบบเข้ารหัส TLS → ตั้ง DB_SSL=true
const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'book_borrow_system',
  ssl: useSsl ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

module.exports = pool;
