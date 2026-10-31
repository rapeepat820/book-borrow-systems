-- ============================================================
-- Migration v10: ยืมหลายเล่มในออเดอร์เดียว + ค่าส่งตามน้ำหนัก + ระบบจองคิวหนังสือ
-- รันบนฐานข้อมูล railway (ไม่มีคำสั่ง USE — เลือกฐานข้อมูล railway ใน DBeaver ก่อน แล้วกด Alt+X)
-- ** รันครั้งเดียว ** ถ้าขึ้น "Duplicate column name" แปลว่าเคยรันแล้ว ไม่ต้องรันซ้ำ
-- รันก่อนอัปโหลดโค้ดใหม่ได้ปลอดภัย (โค้ดเดิมไม่กระทบกับคอลัมน์ที่เพิ่ม)
-- ============================================================

-- น้ำหนักหนังสือ (กรัม) ใช้คิดค่าส่งตามน้ำหนักจริง — ค่าเริ่มต้น 300 กรัม แอดมินแก้เป็นน้ำหนักจริงของแต่ละเล่มได้ในหน้าคลังหนังสือ
ALTER TABLE books
  ADD COLUMN weight_g INT NOT NULL DEFAULT 300;

-- ค่าส่งตามน้ำหนัก = base_fee (ครอบคลุมน้ำหนักไม่เกิน base_weight_g) + ค่าส่งเพิ่มต่อทุก 1 กก. (ปัดขึ้น) ที่เกิน
ALTER TABLE shipping_companies
  ADD COLUMN base_weight_g     INT NOT NULL DEFAULT 1000,
  ADD COLUMN fee_per_extra_kg  DECIMAL(10,2) NOT NULL DEFAULT 0;

-- ย้ายค่า "ค่าส่งเพิ่มต่อเล่ม" เดิมมาเป็น "ค่าส่งเพิ่มต่อ กก." เพื่อไม่ให้ราคาเดิมหาย (แอดมินปรับได้ในหน้าขนส่ง)
UPDATE shipping_companies SET fee_per_extra_kg = fee_per_book WHERE fee_per_extra_kg = 0;

-- ออเดอร์การยืม: รวมหลายเล่มที่ยืมพร้อมกัน ชำระเงินและจัดส่งครั้งเดียว
CREATE TABLE IF NOT EXISTS borrow_orders (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT NOT NULL,
  shipping_company_id INT NOT NULL,
  item_count          INT NOT NULL,
  total_weight_g      INT NOT NULL,              -- น้ำหนักรวมหนังสือ + บรรจุภัณฑ์
  shipping_fee        DECIMAL(10,2) NOT NULL,    -- ค่าส่งรวมทั้งออเดอร์ (แบ่งลงแต่ละเล่มตามน้ำหนักในตาราง borrow_records)
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_user (user_id),
  CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_order_ship FOREIGN KEY (shipping_company_id) REFERENCES shipping_companies(id)
);

ALTER TABLE borrow_records
  ADD COLUMN order_id INT NULL,
  ADD INDEX idx_br_order (order_id);

-- การจองคิวหนังสือที่ถูกยืมหมด
--   waiting   = รอคิว
--   ready     = มีเล่มว่างแล้ว กันไว้ให้ผู้จองจนถึง expires_at
--   fulfilled = ผู้จองยืมเล่มนั้นแล้ว   cancelled = ผู้จองยกเลิก   expired = หมดเวลากันเล่มไว้
CREATE TABLE IF NOT EXISTS book_reservations (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT NOT NULL,
  book_id             INT NOT NULL,
  status              ENUM('waiting','ready','fulfilled','cancelled','expired') NOT NULL DEFAULT 'waiting',
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notified_at         DATETIME NULL,
  expires_at          DATETIME NULL,
  fulfilled_record_id INT NULL,
  INDEX idx_res_book (book_id, status, created_at),
  INDEX idx_res_user (user_id, status),
  CONSTRAINT fk_res_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_res_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
