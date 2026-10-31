# ขั้นตอนอัปเดตเว็บ RP Bookstore (ชุดนี้)

## สิ่งที่เพิ่ม
ยืมหลายเล่ม+ตะกร้า, ค่าส่งเลือกกล่องและขอราคาจริงจาก Flash Express, จองคิวหนังสือ, รายงานสถิติ,
ยืนยันตัวตน (เลขบัตร+รูปบัตร+เซลฟี่), แสดงมูลค่า/มัดจำบนการ์ดหนังสือ

## 1) รัน SQL ใน DBeaver ก่อน (เลือกฐานข้อมูล railway แล้วกด Alt+X ทีละไฟล์ ตามลำดับ)
ไฟล์อยู่ที่ project/backend/database — แต่ละไฟล์รัน "ครั้งเดียว"
1. migration_v10_orders_reservations.sql
2. migration_v11_identity.sql
3. migration_v12_shipping_boxes.sql
(ถ้ายังไม่เคยรัน v8 และ v9 ให้รันก่อน: migration_v8_late_fee_refund.sql, migration_v9_contact.sql)
ถ้าขึ้น "Duplicate column name" = เคยรันแล้ว ข้ามได้

## 2) ตั้งตัวแปรใน Railway (service book-borrow-systems → Variables)
- ID_ENCRYPTION_KEY = ข้อความสุ่มยาวๆ (ตั้งครั้งเดียว ห้ามเปลี่ยนภายหลัง)
- (ถ้าจะใช้ราคาจริงจาก Flash) FLASH_MCH_ID, FLASH_SECRET_KEY, SHIP_FROM_POSTAL
  ทดลองก่อนด้วย FLASH_API_BASE=https://open-api-tra.flashexpress.com
ตัวแปรอื่นดูตัวอย่างใน project/backend/.env.example

## 3) อัปโหลดโค้ด — แนะนำ GitHub Desktop (ไฟล์เยอะ เกิน 100 ไฟล์ของหน้าเว็บ)
1. ติดตั้ง GitHub Desktop → ล็อกอิน → File > Clone repository → rapeepat820/book-borrow-systems
   เลือกโฟลเดอร์ปลายทางที่ไม่ใช่ OneDrive เช่น C:\repo-books
2. แตก zip นี้ แล้วคัดลอกโฟลเดอร์ project ไปวางทับ C:\repo-books\project (Replace all)
3. GitHub Desktop จะแสดงไฟล์ที่เปลี่ยน → ใส่ข้อความ commit → Commit to main → Push origin
4. รอ Railway ขึ้น Active

## 4) หลังขึ้นเว็บ
- แอดมิน: คลังหนังสือ → บริษัทขนส่ง → ตั้งรหัสไปรษณีย์ต้นทาง, ตรวจกล่อง, กด "ทดลองคำนวณ"
- แอดมิน: คลังหนังสือ → แก้น้ำหนักหนังสือแต่ละเล่ม (ค่าเริ่มต้น 300 กรัม)
- สมาชิกเดิมทุกคนต้องยืนยันตัวตนก่อนยืมเล่มถัดไป (เมนูแอดมิน "ยืนยันตัวตน" ไว้อนุมัติ)
