-- ============================================================
-- Migration v9: ช่องทางติดต่อเจ้าหน้าที่ (ข้อมูลร้าน + ฟอร์มส่งข้อความ + กล่องข้อความแอดมิน)
-- รันบนฐานข้อมูล railway (ไม่มีคำสั่ง USE — เลือกฐานข้อมูล railway ใน DBeaver ก่อน แล้วกด Alt+X)
-- รันซ้ำได้ปลอดภัย (IF NOT EXISTS)
-- ============================================================

-- ตั้งค่าเว็บแบบ key/value เช่น เบอร์โทร, LINE, อีเมลร้าน (แอดมินแก้ได้ในหน้าแอดมิน ไม่ต้องแก้โค้ด)
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key   VARCHAR(50) PRIMARY KEY,
  setting_value TEXT,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ข้อความที่ลูกค้าส่งหาเจ้าหน้าที่ (ส่งได้ทั้งตอนล็อกอินและยังไม่ล็อกอิน)
CREATE TABLE IF NOT EXISTS contact_messages (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NULL,                       -- ถ้าล็อกอินอยู่ จะผูกกับสมาชิก
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(150) NOT NULL,
  phone            VARCHAR(20)  NULL,
  subject          VARCHAR(120) NOT NULL,
  message          TEXT NOT NULL,
  borrow_record_id INT NULL,                       -- รายการยืมที่เกี่ยวข้อง (ถ้ามี)
  status           ENUM('new','replied','closed') NOT NULL DEFAULT 'new',
  admin_reply      TEXT NULL,
  replied_at       DATETIME NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_contact_status (status, created_at),
  INDEX idx_contact_user (user_id),
  CONSTRAINT fk_contact_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
