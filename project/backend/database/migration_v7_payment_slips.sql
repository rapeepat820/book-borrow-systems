-- ============================================================
-- Migration v7: บันทึกสลิปที่ใช้ไปแล้ว (กันใช้สลิปซ้ำ) สำหรับระบบอ่านสลิปอัตโนมัติ
-- รันบนฐานข้อมูล railway (ไม่มีคำสั่ง USE — ให้เลือกฐานข้อมูล railway ใน DBeaver ก่อนรัน)
-- รันซ้ำได้ปลอดภัย (IF NOT EXISTS)
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_slips (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  trans_ref        VARCHAR(64) NOT NULL,                 -- เลขอ้างอิงรายการจาก QR บนสลิป (ซ้ำไม่ได้)
  sending_bank     CHAR(3),
  borrow_record_id INT NOT NULL,
  purpose          ENUM('borrow','extend') NOT NULL,      -- ชำระค่ายืม หรือค่าต่ออายุ
  amount           DECIMAL(10,2),                         -- ยอดที่ตรวจพบ (ถ้าตรวจอัตโนมัติ)
  verify_mode      ENUM('auto','qr_only') NOT NULL,       -- auto = ตรวจกับ API แล้ว, qr_only = อ่าน QR อย่างเดียว รอแอดมิน
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_slip_trans_ref (trans_ref),
  INDEX idx_slip_record (borrow_record_id),
  CONSTRAINT fk_slip_record FOREIGN KEY (borrow_record_id) REFERENCES borrow_records(id) ON DELETE CASCADE
);
