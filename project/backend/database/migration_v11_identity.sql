-- ============================================================
-- Migration v11: ยืนยันตัวตนสมาชิก (เลขบัตรประชาชน + รูปบัตร + เซลฟี่ถือบัตร) กันผู้ใช้หลอกลวง
-- รันบนฐานข้อมูล railway (ไม่มีคำสั่ง USE — เลือกฐานข้อมูล railway ใน DBeaver ก่อน แล้วกด Alt+X)
-- ** รันครั้งเดียว ** ถ้าขึ้น "Duplicate column name" แปลว่าเคยรันแล้ว ไม่ต้องรันซ้ำ
-- รันก่อนอัปโหลดโค้ดใหม่ได้ปลอดภัย (โค้ดเดิมไม่กระทบกับคอลัมน์ที่เพิ่ม)
--
-- หลักการเก็บข้อมูล (ข้อมูลอ่อนไหวตาม PDPA — เก็บเท่าที่จำเป็น):
--   * รูปบัตรและเซลฟี่ เก็บแบบเข้ารหัสในฐานข้อมูล (ไม่เปิดเป็นไฟล์สาธารณะ) และ "ลบทิ้งทันที" หลังแอดมินอนุมัติ/ปฏิเสธ
--   * เลขบัตรเต็ม เก็บแบบเข้ารหัสระหว่างรอตรวจเท่านั้น หลังตรวจเสร็จลบทิ้ง เหลือแค่ค่าแฮช (กันสมัครซ้ำ) กับเลข 4 ตัวท้าย
-- ============================================================

ALTER TABLE users
  ADD COLUMN id_verify_status ENUM('unverified','pending','verified','rejected') NOT NULL DEFAULT 'unverified',
  ADD COLUMN national_id_hash CHAR(64) NULL,        -- แฮชของเลขบัตร (ตั้งเมื่ออนุมัติ) ใช้กันคนเดียวสมัครหลายบัญชี
  ADD COLUMN national_id_last4 CHAR(4) NULL,
  ADD COLUMN id_verified_at DATETIME NULL,
  ADD COLUMN id_reject_reason VARCHAR(255) NULL,
  ADD UNIQUE KEY uq_users_national_id (national_id_hash);

-- แอดมินไม่ต้องยืนยันตัวตน
UPDATE users SET id_verify_status = 'verified', id_verified_at = NOW() WHERE role = 'admin';

-- คำขอยืนยันตัวตน (ภาพและเลขบัตรจะถูกล้างเป็น NULL หลังตรวจเสร็จ)
CREATE TABLE IF NOT EXISTS id_verifications (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  status         ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  id_hash        CHAR(64) NOT NULL,
  id_last4       CHAR(4) NOT NULL,
  id_number_enc  VARBINARY(255) NULL,
  id_card_image  MEDIUMBLOB NULL,
  selfie_image   MEDIUMBLOB NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at    DATETIME NULL,
  reviewed_by    INT NULL,
  reject_reason  VARCHAR(255) NULL,
  INDEX idx_idv_status (status, created_at),
  INDEX idx_idv_user (user_id),
  CONSTRAINT fk_idv_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
