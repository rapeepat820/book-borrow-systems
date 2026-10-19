-- ============================================================
-- Migration v8: ค่าปรับเกินกำหนดคืน + ระบบโอนคืนเงินมัดจำ
-- รันบนฐานข้อมูล railway (ไม่มีคำสั่ง USE — ให้เลือกฐานข้อมูล railway ใน DBeaver ก่อนรัน แล้วกด Alt+X)
-- ** รันครั้งเดียว ** ถ้าขึ้น "Duplicate column name" แปลว่าเคยรันแล้ว ไม่ต้องรันซ้ำ
-- รันก่อนอัปโหลดโค้ดใหม่ได้ปลอดภัย (โค้ดเดิมไม่กระทบกับคอลัมน์ที่เพิ่ม)
-- ============================================================

-- บัญชีรับเงินมัดจำคืนของลูกค้า (เก็บในโปรไฟล์ ใช้เติมให้อัตโนมัติตอนแจ้งคืน)
ALTER TABLE users
  ADD COLUMN refund_method       ENUM('promptpay','bank') NULL,
  ADD COLUMN refund_bank         VARCHAR(60)  NULL,
  ADD COLUMN refund_account_no   VARCHAR(30)  NULL,
  ADD COLUMN refund_account_name VARCHAR(100) NULL;

-- ค่าปรับ + สถานะการโอนคืนมัดจำของแต่ละรายการยืม
ALTER TABLE borrow_records
  ADD COLUMN late_fee            DECIMAL(10,2) NOT NULL DEFAULT 0,        -- ค่าปรับที่หักจริง (กำหนดตอนแอดมินยืนยันคืน)
  ADD COLUMN refund_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,        -- ยอดที่ต้องโอนคืน = มัดจำ - ค่าปรับ
  ADD COLUMN refund_status       ENUM('none','pending','refunded') NOT NULL DEFAULT 'none', -- none = ไม่มียอดต้องคืน / ยังไม่ถึงขั้นคืน
  ADD COLUMN refund_account_info VARCHAR(255) NULL,                       -- สำเนาบัญชีรับเงินคืน ณ ตอนแจ้งคืน (กันโปรไฟล์ถูกแก้ภายหลัง)
  ADD COLUMN refunded_at         DATETIME NULL,
  ADD COLUMN refund_reference    VARCHAR(100) NULL,                       -- เลขอ้างอิง/หมายเหตุการโอนคืน (แอดมินกรอก)
  ADD COLUMN last_overdue_notice DATE NULL;                               -- วันที่ส่งอีเมลเตือนเกินกำหนดครั้งล่าสุด (กันส่งซ้ำรัวๆ)

-- รายการที่คืนและ "คืนมัดจำแล้ว" ในระบบเดิม ให้นับเป็นโอนคืนครบแล้ว
UPDATE borrow_records
SET refund_status = 'refunded', refund_amount = deposit_amount, refunded_at = COALESCE(refunded_at, NOW())
WHERE status = 'returned' AND deposit_refunded = 1;
