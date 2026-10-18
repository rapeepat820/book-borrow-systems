-- ============================================================
-- Migration v3: สำหรับฐานข้อมูลที่ deploy ไปแล้วเท่านั้น (ฐานข้อมูลใหม่ไม่ต้องรัน เพราะ schema.sql มีให้ครบแล้ว)
-- ครอบคลุมการเปลี่ยนแปลงตามที่ขอเพิ่มเติม:
--   1) เพิ่มรูปปกหนังสือให้ครบทุกเล่ม (ออกแบบเป็นภาพปกตามหมวดหมู่ ไม่ใช้รูปจากอินเทอร์เน็ต)
--   2) เพิ่มรายละเอียดหนังสือ: สำนักพิมพ์ / ปีที่พิมพ์ / ฉบับ / เล่มที่ / ตีพิมพ์ครั้งที่
--      (ให้ลูกค้าดูรายละเอียดหนังสือได้ก่อนกดยืม ในหน้า BookDetail)
--   3) ปรับระบบขนส่งให้เหลือบริษัทที่ "เปิดใช้งาน" (is_active = 1) ได้ครั้งละบริษัทเดียวเท่านั้น
--      ลูกค้าจะไม่เห็น dropdown ให้เลือกหลายบริษัทอีกต่อไป — ระบบจะใช้บริษัทที่แอดมินตั้งเป็นค่าเริ่มต้นให้อัตโนมัติ
-- รันไฟล์นี้ผ่าน Railway Query tab หรือ mysql client ที่ต่อกับฐานข้อมูลเดิม (รันซ้ำได้ปลอดภัย - idempotent)
-- ============================================================
USE book_borrow_system;

-- ------------------------------------------------------------
-- 1) เพิ่มคอลัมน์รายละเอียดหนังสือ (สำนักพิมพ์ / ปีที่พิมพ์ / ฉบับ / เล่มที่ / พิมพ์ครั้งที่)
--    ใช้ stored procedure เช็คก่อนว่ามีคอลัมน์อยู่แล้วหรือยัง เพื่อให้รันไฟล์นี้ซ้ำได้โดยไม่ error
-- ------------------------------------------------------------
DELIMITER $$
CREATE PROCEDURE __add_book_detail_columns()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books' AND COLUMN_NAME = 'publisher') THEN
    ALTER TABLE books
      ADD COLUMN publisher    VARCHAR(150) AFTER price_value,
      ADD COLUMN publish_year INT          AFTER publisher,
      ADD COLUMN edition      VARCHAR(150) AFTER publish_year,
      ADD COLUMN volume       VARCHAR(50)  AFTER edition,
      ADD COLUMN print_no     INT          AFTER volume;
  END IF;
END$$
DELIMITER ;
CALL __add_book_detail_columns();
DROP PROCEDURE __add_book_detail_columns;

-- ------------------------------------------------------------
-- 2) ใส่รูปปกหนังสือให้กับเล่มตัวอย่างที่ยังไม่มีรูป (ข้าม row ที่แอดมินอัปโหลดรูปเองไปแล้ว)
--    ไฟล์รูปอยู่ในโปรเจกต์ frontend ที่ frontend/public/book-covers/*.jpg (เสิร์ฟที่ /book-covers/...)
--    ต้อง build+deploy frontend เวอร์ชันล่าสุดก่อน ไม่งั้นลิงก์รูปจะ 404
-- ------------------------------------------------------------
UPDATE books SET cover_image = '/book-covers/the-quantum-future.jpg' WHERE title = 'The Quantum Future' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/space-and-light.jpg' WHERE title = 'Space and Light' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/book-f451ba13.jpg' WHERE title = 'เสียงกระซิบจากขุนเขา' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/the-last-lighthouse-keeper.jpg' WHERE title = 'The Last Lighthouse Keeper' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/book-af9f1a54.jpg' WHERE title = 'ก่อนพรุ่งนี้จะมาถึง' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/midnight-in-havoc-city.jpg' WHERE title = 'Midnight in Havoc City' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/book-deaabfe3.jpg' WHERE title = 'ทะเลไม่เคยจำใคร' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/book-54c4ae86.jpg' WHERE title = 'นักสืบจิ๋วแห่งซอยเงียบ เล่ม 1' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/starlight-squad-origins.jpg' WHERE title = 'Starlight Squad: Origins' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/book-a67ef033.jpg' WHERE title = 'ร้านขนมของคุณยายมัตสึ เล่ม 1' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/the-iron-garden.jpg' WHERE title = 'The Iron Garden' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/book-6e8b5721.jpg' WHERE title = 'ตำนานมังกรครึ่งฟ้า เล่ม 1' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/coffee-and-constellations.jpg' WHERE title = 'Coffee and Constellations' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/mindful-leadership.jpg' WHERE title = 'Mindful Leadership' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/book-15eada4b.jpg' WHERE title = 'หลักเศรษฐศาสตร์พฤติกรรมเบื้องต้น' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/introduction-to-applied-statistics.jpg' WHERE title = 'Introduction to Applied Statistics' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/book-5a956f40.jpg' WHERE title = 'พื้นฐานการเขียนโปรแกรมเชิงวัตถุ' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/a-concise-history-of-southeast-asia.jpg' WHERE title = 'A Concise History of Southeast Asia' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/book-a545c380.jpg' WHERE title = 'จิตวิทยาการเรียนรู้สำหรับครู' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/book-a7ef8df1.jpg' WHERE title = 'บันทึกการเดินทาง ฉบับพิมพ์ครั้งแรก' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/first-edition-the-silent-atlas.jpg' WHERE title = 'First Edition: The Silent Atlas' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/book-c5723b09.jpg' WHERE title = 'กวีนิพนธ์ล้านนา ฉบับอนุรักษ์' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/signed-copy-letters-from-the-observatory.jpg' WHERE title = 'Signed Copy: Letters from the Observatory' AND (cover_image IS NULL OR cover_image = '');
UPDATE books SET cover_image = '/book-covers/book-962f4ee7.jpg' WHERE title = 'ตำรายาไทยโบราณ ฉบับหายาก' AND (cover_image IS NULL OR cover_image = '');

-- ------------------------------------------------------------
-- 3) ใส่รายละเอียดหนังสือ (สำนักพิมพ์ / ปีที่พิมพ์ / ฉบับ / เล่มที่ / พิมพ์ครั้งที่) ให้กับเล่มตัวอย่าง
--    ข้าม row ที่แอดมินกรอกข้อมูลเองไปแล้ว (publisher IS NOT NULL)
-- ------------------------------------------------------------
UPDATE books SET publisher = 'Aurora House Publishing', publish_year = 2021, edition = 'ฉบับพิมพ์ครั้งแรก', volume = 'เล่มเดียวจบ', print_no = 1 WHERE title = 'The Quantum Future' AND publisher IS NULL;
UPDATE books SET publisher = 'Aurora House Publishing', publish_year = 2020, edition = 'ฉบับปรับปรุง', volume = 'เล่มเดียวจบ', print_no = 2 WHERE title = 'Space and Light' AND publisher IS NULL;
UPDATE books SET publisher = 'สำนักพิมพ์ประพันธ์สาส์น', publish_year = 2022, edition = 'ฉบับพิมพ์ครั้งแรก', volume = 'เล่มเดียวจบ', print_no = 1 WHERE title = 'เสียงกระซิบจากขุนเขา' AND publisher IS NULL;
UPDATE books SET publisher = 'Lighthouse Press', publish_year = 2019, edition = 'ฉบับพิมพ์ครั้งแรก', volume = 'เล่มเดียวจบ', print_no = 1 WHERE title = 'The Last Lighthouse Keeper' AND publisher IS NULL;
UPDATE books SET publisher = 'สำนักพิมพ์นานมีบุ๊คส์', publish_year = 2023, edition = 'ฉบับพิมพ์ครั้งแรก', volume = 'เล่มเดียวจบ', print_no = 1 WHERE title = 'ก่อนพรุ่งนี้จะมาถึง' AND publisher IS NULL;
UPDATE books SET publisher = 'Renard & Cole Publishing', publish_year = 2018, edition = 'ฉบับปรับปรุงครั้งที่ 2', volume = 'เล่มเดียวจบ', print_no = 3 WHERE title = 'Midnight in Havoc City' AND publisher IS NULL;
UPDATE books SET publisher = 'สำนักพิมพ์ผีเสื้อ', publish_year = 2021, edition = 'ฉบับพิมพ์ครั้งแรก', volume = 'เล่มเดียวจบ', print_no = 1 WHERE title = 'ทะเลไม่เคยจำใคร' AND publisher IS NULL;
UPDATE books SET publisher = 'สำนักพิมพ์การ์ตูนไทย', publish_year = 2022, edition = 'ฉบับการ์ตูน', volume = 'เล่ม 1', print_no = 2 WHERE title = 'นักสืบจิ๋วแห่งซอยเงียบ เล่ม 1' AND publisher IS NULL;
UPDATE books SET publisher = 'Ember Comics Studio', publish_year = 2021, edition = 'ฉบับการ์ตูน', volume = 'เล่ม 1', print_no = 1 WHERE title = 'Starlight Squad: Origins' AND publisher IS NULL;
UPDATE books SET publisher = 'สำนักพิมพ์ซากุระคอมมิค', publish_year = 2023, edition = 'ฉบับการ์ตูน', volume = 'เล่ม 1', print_no = 1 WHERE title = 'ร้านขนมของคุณยายมัตสึ เล่ม 1' AND publisher IS NULL;
UPDATE books SET publisher = 'Ember Comics Studio', publish_year = 2020, edition = 'ฉบับการ์ตูน', volume = 'เล่มเดียวจบ', print_no = 2 WHERE title = 'The Iron Garden' AND publisher IS NULL;
UPDATE books SET publisher = 'สำนักพิมพ์การ์ตูนไทย', publish_year = 2022, edition = 'ฉบับการ์ตูน', volume = 'เล่ม 1', print_no = 1 WHERE title = 'ตำนานมังกรครึ่งฟ้า เล่ม 1' AND publisher IS NULL;
UPDATE books SET publisher = 'Ember Comics Studio', publish_year = 2023, edition = 'ฉบับการ์ตูน', volume = 'รวมเล่ม', print_no = 1 WHERE title = 'Coffee and Constellations' AND publisher IS NULL;
UPDATE books SET publisher = 'Academic Press International', publish_year = 2020, edition = 'ฉบับพิมพ์ครั้งแรก', volume = 'เล่มเดียวจบ', print_no = 1 WHERE title = 'Mindful Leadership' AND publisher IS NULL;
UPDATE books SET publisher = 'สำนักพิมพ์จุฬาลงกรณ์มหาวิทยาลัย', publish_year = 2021, edition = 'ฉบับปรับปรุงครั้งที่ 2', volume = 'เล่มเดียวจบ', print_no = 3 WHERE title = 'หลักเศรษฐศาสตร์พฤติกรรมเบื้องต้น' AND publisher IS NULL;
UPDATE books SET publisher = 'Academic Press International', publish_year = 2019, edition = 'ฉบับปรับปรุงครั้งที่ 3', volume = 'เล่มเดียวจบ', print_no = 4 WHERE title = 'Introduction to Applied Statistics' AND publisher IS NULL;
UPDATE books SET publisher = 'สำนักพิมพ์มหาวิทยาลัยธรรมศาสตร์', publish_year = 2022, edition = 'ฉบับปรับปรุง', volume = 'เล่มเดียวจบ', print_no = 2 WHERE title = 'พื้นฐานการเขียนโปรแกรมเชิงวัตถุ' AND publisher IS NULL;
UPDATE books SET publisher = 'Academic Press International', publish_year = 2018, edition = 'ฉบับพิมพ์ครั้งแรก', volume = 'เล่มเดียวจบ', print_no = 1 WHERE title = 'A Concise History of Southeast Asia' AND publisher IS NULL;
UPDATE books SET publisher = 'สำนักพิมพ์จุฬาลงกรณ์มหาวิทยาลัย', publish_year = 2020, edition = 'ฉบับปรับปรุงครั้งที่ 2', volume = 'เล่มเดียวจบ', print_no = 2 WHERE title = 'จิตวิทยาการเรียนรู้สำหรับครู' AND publisher IS NULL;
UPDATE books SET publisher = 'โรงพิมพ์หลวง', publish_year = 1968, edition = 'ฉบับพิมพ์ครั้งแรก (หายาก)', volume = 'เล่มเดียวจบ', print_no = 1 WHERE title = 'บันทึกการเดินทาง ฉบับพิมพ์ครั้งแรก' AND publisher IS NULL;
UPDATE books SET publisher = 'Royal Cartographic Society', publish_year = 1897, edition = 'ฉบับพิมพ์ครั้งแรก (หายาก)', volume = 'เล่มเดียวจบ', print_no = 1 WHERE title = 'First Edition: The Silent Atlas' AND publisher IS NULL;
UPDATE books SET publisher = 'สำนักพิมพ์ล้านนาอนุรักษ์', publish_year = 1975, edition = 'ฉบับอนุรักษ์ พิมพ์จำกัดจำนวน', volume = 'เล่มเดียวจบ', print_no = 1 WHERE title = 'กวีนิพนธ์ล้านนา ฉบับอนุรักษ์' AND publisher IS NULL;
UPDATE books SET publisher = 'Observatory Press', publish_year = 1954, edition = 'ฉบับพิมพ์จำกัดจำนวน มีลายเซ็นผู้เขียน', volume = 'เล่มเดียวจบ', print_no = 1 WHERE title = 'Signed Copy: Letters from the Observatory' AND publisher IS NULL;
UPDATE books SET publisher = 'คัดลอกจากต้นฉบับใบลาน', publish_year = 1932, edition = 'ฉบับคัดลอกจากใบลาน', volume = 'เล่มเดียวจบ', print_no = 1 WHERE title = 'ตำรายาไทยโบราณ ฉบับหายาก' AND publisher IS NULL;

-- ------------------------------------------------------------
-- 4) จำกัดให้ "เปิดใช้งาน" ได้ครั้งละบริษัทเดียว — เก็บบริษัทที่เปิดใช้งานอยู่ id น้อยสุดไว้ ปิดที่เหลือทั้งหมด
--    (ระบบฝั่งแอดมิน/backend จะบังคับกติกานี้ต่อจากนี้ไปทุกครั้งที่ตั้งบริษัทใดเป็นค่าเริ่มต้น)
-- ------------------------------------------------------------
UPDATE shipping_companies
SET is_active = 0
WHERE is_active = 1
  AND id <> (SELECT id FROM (SELECT MIN(id) AS id FROM shipping_companies WHERE is_active = 1) AS t);

-- ถ้ายังไม่มีบริษัทใดเปิดใช้งานเลย (กรณีข้อมูลเดิมปิดหมด) ให้เปิดบริษัทแรกที่มีในระบบเป็นค่าเริ่มต้นอัตโนมัติ
UPDATE shipping_companies
SET is_active = 1
WHERE id = (SELECT id FROM (SELECT MIN(id) AS id FROM shipping_companies) AS t)
  AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM shipping_companies WHERE is_active = 1) AS t2);
