-- ============================================================
-- Migration v6: ตารางเก็บรหัส OTP สำหรับ "ลืมรหัสผ่าน" (ส่งทางอีเมล)
-- รันบนฐานข้อมูล railway (ไม่มีคำสั่ง USE — ให้เลือกฐานข้อมูล railway ใน DBeaver ก่อนรัน)
-- รันซ้ำได้ปลอดภัย (IF NOT EXISTS)
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  otp_hash    CHAR(64) NOT NULL,                 -- HMAC-SHA256 ของ OTP (ไม่เก็บเลขจริง)
  attempts    INT NOT NULL DEFAULT 0,            -- จำนวนครั้งที่กรอกผิด
  expires_at  DATETIME NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_user (user_id),
  CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
