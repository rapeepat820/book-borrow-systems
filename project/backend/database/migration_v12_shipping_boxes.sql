-- ============================================================
-- Migration v12: ค่าส่งคิดตามกล่อง + ขอราคาจริงจาก API ขนส่ง (Flash Express) + บันทึกต้นทุนจัดส่งจริง
-- รันบนฐานข้อมูล railway (ไม่มีคำสั่ง USE — เลือกฐานข้อมูล railway ใน DBeaver ก่อน แล้วกด Alt+X)
-- ** รันครั้งเดียว ** ถ้าขึ้น "Duplicate column name" แปลว่าเคยรันแล้ว ไม่ต้องรันซ้ำ
-- รันก่อนอัปโหลดโค้ดใหม่ได้ปลอดภัย
-- ============================================================

-- วิธีหาค่าส่งของขนส่งแต่ละเจ้า: manual = ตารางราคาที่แอดมินกรอก (ค่าเริ่มต้น + ต่อ กก.), flash = ขอราคาจริงจาก Flash Express API
-- markup_percent = บวกเพิ่มจากราคาที่ได้ (เช่น 5 = +5% ไว้ครอบคลุมค่าบรรจุภัณฑ์/ส่วนต่าง) ใช้กับราคาจาก API
ALTER TABLE shipping_companies
  ADD COLUMN rate_provider  ENUM('manual','flash') NOT NULL DEFAULT 'manual',
  ADD COLUMN markup_percent DECIMAL(5,2) NOT NULL DEFAULT 0;

-- ขนาดกล่องที่ร้านมี: ระบบเลือกกล่องเล็กสุดที่ใส่หนังสือทั้งออเดอร์ได้ (ตามจำนวนเล่มและน้ำหนัก) แล้วใช้ขนาดกล่องนั้นขอราคาขนส่ง
CREATE TABLE IF NOT EXISTS shipping_boxes (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  name               VARCHAR(40) NOT NULL,
  max_items          INT NOT NULL,                    -- ใส่หนังสือได้สูงสุดกี่เล่ม
  max_book_weight_g  INT NOT NULL,                    -- น้ำหนักหนังสือรวมสูงสุดที่กล่องนี้รับได้ (กรัม)
  length_cm          INT NOT NULL,
  width_cm           INT NOT NULL,
  height_cm          INT NOT NULL,
  packaging_weight_g INT NOT NULL DEFAULT 100,        -- น้ำหนักตัวกล่อง + วัสดุกันกระแทก
  is_active          TINYINT(1) NOT NULL DEFAULT 1,
  sort_order         INT NOT NULL DEFAULT 0
);

INSERT INTO shipping_boxes (name, max_items, max_book_weight_g, length_cm, width_cm, height_cm, packaging_weight_g, sort_order)
SELECT * FROM (
  SELECT 'กล่อง S (1-2 เล่ม)' AS name, 2 AS max_items, 1200 AS w, 25 AS l, 18 AS wd, 8 AS h, 120 AS pk, 1 AS so UNION ALL
  SELECT 'กล่อง M (3-4 เล่ม)', 4, 2500, 32, 24, 12, 180, 2 UNION ALL
  SELECT 'กล่อง L (5 เล่ม)', 5, 4000, 38, 28, 16, 250, 3
) AS seed WHERE NOT EXISTS (SELECT 1 FROM shipping_boxes);

-- บันทึกว่าแต่ละรายการใช้กล่องไหน น้ำหนักพัสดุเท่าไร และต้นทุนจริงที่ขนส่งเก็บจากร้าน (แอดมินกรอกตอนส่ง)
ALTER TABLE borrow_records
  ADD COLUMN box_name             VARCHAR(40) NULL,
  ADD COLUMN parcel_weight_g      INT NULL,
  ADD COLUMN shipping_rate_source VARCHAR(20) NULL,          -- flash / manual / manual_fallback
  ADD COLUMN shipping_cost_actual DECIMAL(10,2) NULL;        -- ต้นทุนค่าส่งจริงของพัสดุ (บันทึกที่รายการแรกของออเดอร์)
