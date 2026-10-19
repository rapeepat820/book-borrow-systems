// ทดสอบการส่งอีเมลจริงจากค่าใน .env:  npm run test-mail -- you@example.com
require('dotenv').config();
const { sendMail, isMailConfigured } = require('../utils/mailer');

const to = process.argv[2] || process.env.SMTP_USER;
if (!isMailConfigured()) {
  console.error('✗ ยังไม่ได้ตั้งค่า SMTP_USER / SMTP_PASS ใน backend/.env (ยังเป็นค่าตัวอย่างอยู่)');
  process.exit(1);
}
sendMail(to, 'ทดสอบระบบอีเมล RP Bookstore', '<p>ถ้าเห็นอีเมลนี้ แสดงว่าตั้งค่า SMTP ถูกต้องแล้ว ✅</p>')
  .then(() => console.log('✓ ส่งอีเมลทดสอบไปที่', to, 'สำเร็จ'))
  .catch(err => { console.error('✗ ส่งไม่สำเร็จ:', err.hint || err.message); process.exit(1); });
