// สร้างค่า bcrypt hash ของรหัสผ่าน ไว้ตั้งรหัสแอดมินในฐานข้อมูลใหม่
// วิธีใช้ (ในโฟลเดอร์ backend):  node scripts/make-password-hash.js "รหัสผ่านที่ต้องการ"
// จากนั้นเอาผลลัพธ์ไปใส่คำสั่ง SQL:  UPDATE users SET password_hash = '<ผลลัพธ์>' WHERE email = 'admin@bookshop.local';
const bcrypt = require('bcrypt');

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('ใส่รหัสผ่านอย่างน้อย 8 ตัวอักษร เช่น  node scripts/make-password-hash.js "MyStrongPass123"');
  process.exit(1);
}
bcrypt.hash(password, 10).then(hash => {
  console.log('\nคัดลอกคำสั่งนี้ไปรันในฐานข้อมูล (แทนที่ใน SQL Editor):\n');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'admin@bookshop.local';\n`);
});
