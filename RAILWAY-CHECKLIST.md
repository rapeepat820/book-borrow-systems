# เช็กลิสต์ RP Bookstore บน Railway (แพลนที่ซื้อแล้ว)

1. อัปโหลดโค้ดชุดนี้ขึ้น GitHub (แตก zip -> เอาโฟลเดอร์ project วางทับ -> Commit -> Push) Railway จะ build ให้เอง
   Root Directory = /project, Build = npm run build, Start = npm start
2. ฐานข้อมูล Railway MySQL ต้องรันครบถึง v12 (ถ้าเคยรัน v9 แล้ว ให้รันเฉพาะที่ยังไม่เคยรัน):
   backend/database/migration_v10_orders_reservations.sql
   backend/database/migration_v11_identity.sql
   backend/database/migration_v12_shipping_boxes.sql
   (ฐานข้อมูลใหม่เปล่า ใช้ setup-all.sql ไฟล์เดียวพอ)
3. Variables บน Railway ที่ต้องมี: DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME, JWT_SECRET, FRONTEND_URL,
   ID_ENCRYPTION_KEY (ตั้งครั้งเดียว ห้ามเปลี่ยน), BREVO_API_KEY/MAIL_FROM_EMAIL/MAIL_FROM_NAME (ถ้าใช้อีเมล)
   ไม่ต้องตั้ง DB_SSL (ใช้เฉพาะ TiDB)
4. ตั้ง GitHub repo เป็น Private และลบรูปลูกค้าเก่าใน backend/uploads (ชุดนี้ลบออกให้แล้ว)
5. Railway ไม่มีดิสก์ถาวรโดยค่าเริ่มต้น: รูปที่อัปโหลดจะหายเมื่อ redeploy ถ้าไม่ได้ตั้ง Cloudinary หรือเพิ่ม Volume
