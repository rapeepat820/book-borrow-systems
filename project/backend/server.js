require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

// ------------------------------------------------------------
// ตรวจสอบ environment variables ที่จำเป็นก่อนเริ่มรัน — ถ้าขาดจะแจ้ง error ที่ชัดเจนทันที
// แทนที่จะไปพังแบบงงๆ ตอนมีคนเรียกใช้งานจริง
// ------------------------------------------------------------
const REQUIRED_ENV = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`[startup] ขาดตัวแปรสภาพแวดล้อมที่จำเป็น: ${missingEnv.join(', ')}`);
  console.error('[startup] กรุณาตั้งค่าใน .env (ดูตัวอย่างที่ .env.example) ก่อนรันเซิร์ฟเวอร์');
  process.exit(1);
}
if (!process.env.CLOUDINARY_CLOUD_NAME) {
  console.warn('[startup] ยังไม่ได้ตั้งค่า Cloudinary — รูปที่อัปโหลด (สลิป/หลักฐานคืน) จะเก็บไว้ในดิสก์เครื่องนี้ '
    + 'ซึ่งจะหายไปเมื่อ redeploy บน hosting ที่ใช้พื้นที่เก็บไฟล์ชั่วคราว (เช่น Railway) — ดู DEPLOY.md');
}

const contactRoutes = require('./routes/contact');
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const borrowRoutes = require('./routes/borrow');
const adminRoutes = require('./routes/admin');
const { startReminderCron } = require('./utils/reminderCron');
const pool = require('./config/db');
const { runAutoSetup } = require('./utils/bookAutoSetup');

const app = express();

// อยู่หลัง proxy ของ Railway: ให้ rate limit เห็น IP จริงของผู้ใช้ (ไม่ใช่ IP ของ proxy)
app.set('trust proxy', 1);

// helmet: ตั้งค่า HTTP security headers พื้นฐาน (X-Content-Type-Options, X-Frame-Options ฯลฯ)
// ปิด contentSecurityPolicy ไว้ก่อนเพื่อไม่ให้บล็อกการโหลดไฟล์ static ของ frontend โดยไม่ได้ตั้งใจ
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// จำกัด CORS ให้เหลือเฉพาะโดเมนของ frontend จริงถ้าตั้งค่า FRONTEND_URL ไว้ (แนะนำสำหรับ production)
// ถ้ายังไม่ตั้งค่า (เช่น ตอน dev) จะอนุญาตทุกโดเมนไปก่อนเพื่อความสะดวก
app.use(cors(process.env.FRONTEND_URL ? { origin: process.env.FRONTEND_URL, credentials: true } : {}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // เสิร์ฟรูปหลักฐานการคืน/สลิป (โหมด local เท่านั้น)

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/borrow', borrowRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ------------------------------------------------------------
// เสิร์ฟหน้าเว็บ frontend ที่ build แล้ว (production) จาก frontend/dist
// ทำให้ deploy ได้เป็น service เดียว (backend + frontend อยู่โดเมนเดียวกัน)
// ในโหมด dev (ยังไม่ได้ build) โฟลเดอร์นี้จะไม่มี — ข้ามส่วนนี้ไปเงียบๆ ไม่กระทบการรัน `npm run dev` ตามปกติ
// ------------------------------------------------------------
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const frontendIndexHtml = path.join(frontendDist, 'index.html');

if (fs.existsSync(frontendIndexHtml)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(frontendIndexHtml);
  });
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (fs.existsSync(frontendIndexHtml)) {
    console.log('Serving built frontend from frontend/dist');
  }
  startReminderCron();

  // เติมรูปปก/ปีที่พิมพ์/ฉบับที่/เล่มที่ ให้หนังสือที่ยังว่างอัตโนมัติ (ทำเบื้องหลัง ไม่ขวางการใช้งาน)
  // ปิดได้โดยตั้ง AUTO_FILL_BOOKS=false ใน .env
  if (process.env.AUTO_FILL_BOOKS !== 'false') {
    runAutoSetup(pool).catch(err => console.error('[books] auto setup:', err.message));
  }
});
