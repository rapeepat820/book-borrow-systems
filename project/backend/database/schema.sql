-- ============================================================
-- ระบบยืม-คืนหนังสือออนไลน์ (Book Borrow-Return System)
-- Database: MySQL 8.x
-- ============================================================

--CREATE DATABASE IF NOT EXISTS book_borrow_system
--CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--USE book_borrow_system;

-- ------------------------------------------------------------
-- 1) ผู้ใช้งาน (ลูกค้า + แอดมิน)
-- ------------------------------------------------------------
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),
  address       TEXT,                    -- ที่อยู่แบบเต็ม (สร้างอัตโนมัติจากฟิลด์ด้านล่างตอนสมัคร/แก้ไขโปรไฟล์)
  address_detail VARCHAR(255),           -- บ้านเลขที่ / หมู่บ้าน / ซอย / ถนน (กรอกเอง)
  subdistrict   VARCHAR(100),            -- ตำบล/แขวง (เลือกจาก dropdown)
  district      VARCHAR(100),            -- อำเภอ/เขต (เลือกจาก dropdown)
  province      VARCHAR(100),            -- จังหวัด (เลือกจาก dropdown)
  postal_code   VARCHAR(10),             -- รหัสไปรษณีย์ (เติมอัตโนมัติตามตำบลที่เลือก)
  role          ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  status        ENUM('active','suspended') NOT NULL DEFAULT 'active',
  reset_token         VARCHAR(255),   -- โทเคนสำหรับ "สร้างรหัสผ่านใหม่" (ลืมรหัสผ่าน)
  reset_token_expires  DATETIME,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 2) ประเภทหนังสือ -> กำหนดจำนวนวันยืมได้ + ค่ามัดจำมาตรฐานของประเภท
--    (ข้อ 4: ระยะเวลาในการยืมแปรผันตามประเภทหนังสือ)
--    (ข้อ 6: ค่ามัดจำในการยืมหนังสือ)
-- ------------------------------------------------------------
CREATE TABLE book_types (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  type_name       VARCHAR(100) NOT NULL,          -- เช่น นิยาย, การ์ตูน, ตำรา, หนังสือหายาก
  borrow_days     INT NOT NULL DEFAULT 7,          -- จำนวนวันที่ยืมได้ตามประเภท
  deposit_amount  DECIMAL(10,2) NOT NULL DEFAULT 0 -- ค่ามัดจำมาตรฐานของประเภทนี้ (บาท)
);

-- ------------------------------------------------------------
-- 3) หนังสือ
-- ------------------------------------------------------------
CREATE TABLE books (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  author        VARCHAR(150),
  cover_image   VARCHAR(255),
  description   TEXT,
  book_type_id  INT NOT NULL,
  total_copies  INT NOT NULL DEFAULT 1,
  available_copies INT NOT NULL DEFAULT 1,
  price_value   DECIMAL(10,2) DEFAULT 0,   -- มูลค่าหนังสือ (อ้างอิงตั้งค่ามัดจำเพิ่มเติมได้)
  publisher     VARCHAR(150),            -- สำนักพิมพ์
  publish_year  INT,                     -- ปีที่พิมพ์ (ค.ศ.)
  edition       VARCHAR(150),            -- ฉบับ (เช่น ฉบับพิมพ์ครั้งแรก, ฉบับปรับปรุง, ฉบับอนุรักษ์)
  volume        VARCHAR(50),             -- เล่มที่ (เช่น เล่ม 1, เล่มเดียวจบ)
  print_no      INT,                     -- ตีพิมพ์ครั้งที่
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_type_id) REFERENCES book_types(id)
);

-- ------------------------------------------------------------
-- 4) บริษัทขนส่ง (ต้นแบบคำนวณค่าจัดส่ง)
--    (ข้อ 5: การคิดราคาค่าจัดส่ง เลือกบริษัทต้นแบบ)
--    ต้นแบบที่เลือกใช้: บริการจัดส่งลักษณะเดียวกับ Kerry Express / Flash Express / ไปรษณีย์ไทย (EMS)
--    โครงสร้างราคาแบบง่าย: ค่าเริ่มต้น + คิดตามน้ำหนัก/ระยะเวลาส่ง
--    (ข้อ 1: ระยะเวลาในการจัดส่งมีผลต่อระยะเวลาการยืม-คืน -> extra_days จะถูกบวกเข้าไปใน due_date)
-- ------------------------------------------------------------
CREATE TABLE shipping_companies (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,      -- เช่น Kerry Express, Flash Express, ไปรษณีย์ไทย (EMS)
  base_fee      DECIMAL(10,2) NOT NULL,     -- ค่าจัดส่งเริ่มต้น
  fee_per_book  DECIMAL(10,2) NOT NULL DEFAULT 0, -- ค่าจัดส่งเพิ่มต่อเล่ม (น้ำหนัก)
  delivery_days INT NOT NULL,               -- จำนวนวันจัดส่งโดยประมาณ (ใช้บวกเข้าระยะเวลายืม)
  tracking_url  VARCHAR(255),               -- ลิงก์หน้าเช็คสถานะพัสดุของบริษัทขนส่ง (ให้ลูกค้ากดไปวางเลข tracking เอง)
  is_active     TINYINT(1) NOT NULL DEFAULT 1
);

-- ------------------------------------------------------------
-- 5) รายการยืม-คืน
--    (ข้อ 2: จัดเก็บ tracking no.)
--    (ข้อ 3: แนบหลักฐานการคืน เช่น ภาพถ่าย)
-- ------------------------------------------------------------
CREATE TABLE borrow_records (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  user_id            INT NOT NULL,
  book_id            INT NOT NULL,
  shipping_company_id INT NOT NULL,
  tracking_no        VARCHAR(100),                 -- เลขพัสดุ (บันทึกหลังแอดมินจัดส่ง)
  shipping_address   TEXT NOT NULL,                -- ที่อยู่จัดส่งของผู้ยืม (กรอกต่อรายการยืมแต่ละครั้ง)
  shipping_fee       DECIMAL(10,2) NOT NULL,
  deposit_amount     DECIMAL(10,2) NOT NULL,
  borrow_date        DATE NOT NULL,
  due_date           DATE NOT NULL,                -- = borrow_date + book_type.borrow_days + shipping.delivery_days
  return_date        DATE,
  return_proof_image VARCHAR(255),                 -- path รูปหลักฐานการคืน
  status ENUM('pending_shipment','borrowing','return_requested','returned','overdue')
         NOT NULL DEFAULT 'pending_shipment',
  -- สถานะกระบวนการจัดส่งแบบละเอียด ให้ผู้ยืมติดตามได้ว่าพัสดุถึงขั้นตอนไหนแล้ว
  shipping_status ENUM('preparing','shipped','out_for_delivery','delivered') NOT NULL DEFAULT 'preparing',
  deposit_refunded   TINYINT(1) NOT NULL DEFAULT 0,
  -- การชำระเงิน (ค่าจัดส่ง + ค่ามัดจำ) ผ่าน PromptPay QR ตอนยืม พร้อมแนบสลิปยืนยัน
  payment_status ENUM('pending','pending_verification','paid') NOT NULL DEFAULT 'pending',
  payment_method ENUM('promptpay','cash') NOT NULL DEFAULT 'promptpay',
  payment_slip_image VARCHAR(255),        -- รูปสลิปโอนเงินที่ลูกค้าแนบ
  paid_at DATETIME,
  -- คำขอต่ออายุยืม (ยืนเวลาคืน) ต้องชำระค่าธรรมเนียมต่ออายุก่อน แล้วแอดมินตรวจสอบสลิป
  -- จึงจะมีผลกับ due_date จริง (คิดค่าธรรมเนียมตามจำนวนวันที่ขอต่อ)
  extend_requested_days INT,
  extend_status ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none',
  extend_fee DECIMAL(10,2),                       -- ค่าธรรมเนียมต่ออายุที่ต้องชำระ (คำนวณตอนขอต่ออายุ)
  extend_payment_status ENUM('none','pending','pending_verification','paid') NOT NULL DEFAULT 'none',
  extend_payment_slip_image VARCHAR(255),         -- รูปสลิปโอนเงินค่าธรรมเนียมต่ออายุที่ลูกค้าแนบ
  extend_paid_at DATETIME,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (shipping_company_id) REFERENCES shipping_companies(id)
);

-- ------------------------------------------------------------
-- ข้อมูลตัวอย่าง (seed)
-- ------------------------------------------------------------
INSERT INTO book_types (type_name, borrow_days, deposit_amount) VALUES
('นิยายทั่วไป', 7, 100.00),
('การ์ตูน/คอมมิค', 5, 50.00),
('ตำราเรียน/วิชาการ', 14, 300.00),
('หนังสือหายาก/ราคาสูง', 10, 500.00);

-- ระบบใช้บริษัทขนส่งเพียงบริษัทเดียวเป็นค่ามาตรฐาน (Kerry Express) — ลูกค้าจะไม่เห็นตัวเลือกให้เปรียบเทียบ
-- แอดมินสามารถเพิ่มบริษัทอื่นไว้เป็นตัวเลือกสำรองได้ที่หน้า "ขนส่ง" แต่เปิดใช้งาน (is_active) ได้ทีละบริษัทเท่านั้น
INSERT INTO shipping_companies (name, base_fee, fee_per_book, delivery_days, tracking_url, is_active) VALUES
('Kerry Express', 40.00, 10.00, 1, 'https://th.kerryexpress.com/th/track/', 1),
('ไปรษณีย์ไทย (EMS)', 50.00, 5.00, 3, 'https://track.thailandpost.co.th/', 0);

INSERT INTO users (full_name, email, password_hash, role) VALUES
('ผู้ดูแลระบบ', 'admin@bookshop.local', '$2b$10$replace_with_bcrypt_hash', 'admin');

INSERT INTO books (title, author, cover_image, description, book_type_id, total_copies, available_copies, price_value, publisher, publish_year, edition, volume, print_no) VALUES
-- นิยายทั่วไป (book_type_id = 1)
('The Quantum Future', 'Dr. Eliza Reed', '/book-covers/the-quantum-future.jpg', 'สำรวจแนวคิดฟิสิกส์ควอนตัมที่จะเปลี่ยนอนาคตของเทคโนโลยีและชีวิตมนุษย์ อธิบายด้วยภาษาที่เข้าใจง่ายสำหรับผู้อ่านทั่วไป', 1, 3, 3, 350, 'Aurora House Publishing', 2021, 'ฉบับพิมพ์ครั้งแรก', 'เล่มเดียวจบ', 1),
('Space and Light', 'Dr. Eliza Reed', '/book-covers/space-and-light.jpg', 'หนังสือภาพถ่ายและบทความว่าด้วยความสัมพันธ์ระหว่างสถาปัตยกรรม แสง และพื้นที่ว่าง', 1, 2, 2, 420, 'Aurora House Publishing', 2020, 'ฉบับปรับปรุง', 'เล่มเดียวจบ', 2),
('เสียงกระซิบจากขุนเขา', 'ปรียา ตันติวงศ์', '/book-covers/book-f451ba13.jpg', 'นิยายดราม่าครอบครัวในหมู่บ้านเชิงเขาภาคเหนือ ว่าด้วยความลับที่ถูกฝังไว้สามชั่วอายุคน', 1, 3, 3, 220, 'สำนักพิมพ์ประพันธ์สาส์น', 2022, 'ฉบับพิมพ์ครั้งแรก', 'เล่มเดียวจบ', 1),
('The Last Lighthouse Keeper', 'Martin Cole', '/book-covers/the-last-lighthouse-keeper.jpg', 'นิยายว่าด้วยชายเฝ้าประภาคารคนสุดท้ายบนเกาะร้าง กับจดหมายลึกลับที่ลอยมาเกยฝั่งทุกเดือน', 1, 2, 2, 260, 'Lighthouse Press', 2019, 'ฉบับพิมพ์ครั้งแรก', 'เล่มเดียวจบ', 1),
('ก่อนพรุ่งนี้จะมาถึง', 'ณัฐพงษ์ ศรีสุข', '/book-covers/book-af9f1a54.jpg', 'เรื่องราวความรักและการเติบโตของกลุ่มเพื่อนวัยมัธยมในช่วงซัมเมอร์สุดท้ายก่อนแยกย้าย', 1, 4, 4, 190, 'สำนักพิมพ์นานมีบุ๊คส์', 2023, 'ฉบับพิมพ์ครั้งแรก', 'เล่มเดียวจบ', 1),
('Midnight in Havoc City', 'Renée Castillo', '/book-covers/midnight-in-havoc-city.jpg', 'นิยายสืบสวนสอบสวนแนวนัวร์ ตามรอยนักสืบเอกชนไขคดีฆาตกรรมในเมืองที่ไม่เคยหลับใหล', 1, 2, 2, 280, 'Renard & Cole Publishing', 2018, 'ฉบับปรับปรุงครั้งที่ 2', 'เล่มเดียวจบ', 3),
('ทะเลไม่เคยจำใคร', 'อรุณ วิไลลักษณ์', '/book-covers/book-deaabfe3.jpg', 'นิยายอิงชีวิตชุมชนชาวประมงชายฝั่งอันดามัน ก่อนและหลังภัยพิบัติครั้งใหญ่', 1, 3, 3, 240, 'สำนักพิมพ์ผีเสื้อ', 2021, 'ฉบับพิมพ์ครั้งแรก', 'เล่มเดียวจบ', 1),

-- การ์ตูน/คอมมิค (book_type_id = 2)
('นักสืบจิ๋วแห่งซอยเงียบ เล่ม 1', 'วาดโดย เมษ์ ศิลป์ไชย', '/book-covers/book-54c4ae86.jpg', 'การ์ตูนสืบสวนสำหรับเด็กโต ตามติดแก๊งเพื่อนซี้ไขปริศนาในย่านที่พวกเขาอยู่', 2, 5, 5, 120, 'สำนักพิมพ์การ์ตูนไทย', 2022, 'ฉบับการ์ตูน', 'เล่ม 1', 2),
('Starlight Squad: Origins', 'Art by Jules Renard', '/book-covers/starlight-squad-origins.jpg', 'คอมมิคซูเปอร์ฮีโร่วัยรุ่นที่ต้องเรียนรู้พลังพิเศษไปพร้อมกับการสอบปลายภาค', 2, 4, 4, 150, 'Ember Comics Studio', 2021, 'ฉบับการ์ตูน', 'เล่ม 1', 1),
('ร้านขนมของคุณยายมัตสึ เล่ม 1', 'อิลลัสเตรเตอร์: ฮารุกะ อิโต', '/book-covers/book-a67ef033.jpg', 'การ์ตูนสไตล์ชีวิตประจำวัน บอกเล่าความอบอุ่นในร้านขนมเล็กๆ ริมทางรถไฟ', 2, 5, 5, 130, 'สำนักพิมพ์ซากุระคอมมิค', 2023, 'ฉบับการ์ตูน', 'เล่ม 1', 1),
('The Iron Garden', 'Art by Lucas Bergman', '/book-covers/the-iron-garden.jpg', 'คอมมิคไซไฟหลังหายนะ ว่าด้วยกลุ่มนักประดิษฐ์ที่พยายามฟื้นฟูโลกด้วยหุ่นยนต์เก่า', 2, 3, 3, 160, 'Ember Comics Studio', 2020, 'ฉบับการ์ตูน', 'เล่มเดียวจบ', 2),
('ตำนานมังกรครึ่งฟ้า เล่ม 1', 'วาดโดย ทีมงาน Dragon Ink Studio', '/book-covers/book-6e8b5721.jpg', 'การ์ตูนแฟนตาซีกำลังภายในไทย ว่าด้วยเด็กหนุ่มผู้ตื่นพลังมังกรโบราณ', 2, 4, 4, 140, 'สำนักพิมพ์การ์ตูนไทย', 2022, 'ฉบับการ์ตูน', 'เล่ม 1', 1),
('Coffee and Constellations', 'Art by Min-jun Oh', '/book-covers/coffee-and-constellations.jpg', 'คอมมิครวมเรื่องสั้นแนวโรแมนติกคอมเมดี้ เกิดขึ้นในร้านกาแฟที่เปิดเฉพาะกลางคืน', 2, 3, 3, 120, 'Ember Comics Studio', 2023, 'ฉบับการ์ตูน', 'รวมเล่ม', 1),

-- ตำราเรียน/วิชาการ (book_type_id = 3)
('Mindful Leadership', 'Anong Suwan', '/book-covers/mindful-leadership.jpg', 'จิตวิทยาการบริหารองค์กรใหม่ แนวทางการเป็นผู้นำอย่างมีสติในโลกที่เปลี่ยนแปลงรวดเร็ว', 3, 4, 4, 280, 'Academic Press International', 2020, 'ฉบับพิมพ์ครั้งแรก', 'เล่มเดียวจบ', 1),
('หลักเศรษฐศาสตร์พฤติกรรมเบื้องต้น', 'ผศ.ดร. กิตติ ธนวัฒน์', '/book-covers/book-15eada4b.jpg', 'ตำราแนะนำแนวคิดเศรษฐศาสตร์พฤติกรรม พร้อมกรณีศึกษาจากตลาดจริงในไทย', 3, 3, 3, 380, 'สำนักพิมพ์จุฬาลงกรณ์มหาวิทยาลัย', 2021, 'ฉบับปรับปรุงครั้งที่ 2', 'เล่มเดียวจบ', 3),
('Introduction to Applied Statistics', 'Prof. Karen Whitfield', '/book-covers/introduction-to-applied-statistics.jpg', 'ตำราสถิติประยุกต์สำหรับนักศึกษาสายวิทย์-สังคม เน้นตัวอย่างจากงานวิจัยจริง', 3, 3, 3, 420, 'Academic Press International', 2019, 'ฉบับปรับปรุงครั้งที่ 3', 'เล่มเดียวจบ', 4),
('พื้นฐานการเขียนโปรแกรมเชิงวัตถุ', 'อ.ปิยะดา รุ่งเรือง', '/book-covers/book-5a956f40.jpg', 'ตำราเรียนสำหรับผู้เริ่มต้นเขียนโปรแกรม อธิบายแนวคิด OOP ด้วยตัวอย่างภาษา Java', 3, 4, 4, 350, 'สำนักพิมพ์มหาวิทยาลัยธรรมศาสตร์', 2022, 'ฉบับปรับปรุง', 'เล่มเดียวจบ', 2),
('A Concise History of Southeast Asia', 'Dr. Hendra Wibowo', '/book-covers/a-concise-history-of-southeast-asia.jpg', 'ตำราประวัติศาสตร์เอเชียตะวันออกเฉียงใต้ฉบับย่อ ครอบคลุมตั้งแต่ยุคอาณาจักรโบราณถึงยุคปัจจุบัน', 3, 2, 2, 400, 'Academic Press International', 2018, 'ฉบับพิมพ์ครั้งแรก', 'เล่มเดียวจบ', 1),
('จิตวิทยาการเรียนรู้สำหรับครู', 'รศ. สุนีย์ ภูมิพัฒน์', '/book-covers/book-a545c380.jpg', 'ตำราจิตวิทยาการศึกษา เน้นทฤษฎีที่นำไปใช้ออกแบบการสอนในห้องเรียนจริง', 3, 3, 3, 320, 'สำนักพิมพ์จุฬาลงกรณ์มหาวิทยาลัย', 2020, 'ฉบับปรับปรุงครั้งที่ 2', 'เล่มเดียวจบ', 2),

-- หนังสือหายาก/ราคาสูง (book_type_id = 4)
('บันทึกการเดินทาง ฉบับพิมพ์ครั้งแรก', 'หลวงวิจิตร บรรณาธิการ', '/book-covers/book-a7ef8df1.jpg', 'หนังสือประวัติศาสตร์หายาก พิมพ์ครั้งแรก สภาพเก็บรักษาอย่างดี เหมาะสำหรับผู้สนใจประวัติศาสตร์ไทย', 4, 1, 1, 2200, 'โรงพิมพ์หลวง', 1968, 'ฉบับพิมพ์ครั้งแรก (หายาก)', 'เล่มเดียวจบ', 1),
('First Edition: The Silent Atlas', 'Cartographer Wilhelm Kraus', '/book-covers/first-edition-the-silent-atlas.jpg', 'หนังสือแผนที่โบราณฉบับพิมพ์ครั้งแรก รวบรวมแผนที่การเดินเรือศตวรรษที่ 19', 4, 1, 1, 3500, 'Royal Cartographic Society', 1897, 'ฉบับพิมพ์ครั้งแรก (หายาก)', 'เล่มเดียวจบ', 1),
('กวีนิพนธ์ล้านนา ฉบับอนุรักษ์', 'ครูบาแสง วรรณคีรี', '/book-covers/book-c5723b09.jpg', 'รวมกวีนิพนธ์ล้านนาโบราณ ถอดความและเรียบเรียงใหม่ พิมพ์จำนวนจำกัด', 4, 1, 1, 1800, 'สำนักพิมพ์ล้านนาอนุรักษ์', 1975, 'ฉบับอนุรักษ์ พิมพ์จำกัดจำนวน', 'เล่มเดียวจบ', 1),
('Signed Copy: Letters from the Observatory', 'Dr. Sofia Marquez', '/book-covers/signed-copy-letters-from-the-observatory.jpg', 'หนังสือวิทยาศาสตร์ดาราศาสตร์ พร้อมลายเซ็นผู้เขียน ฉบับพิมพ์จำกัดจำนวน', 4, 1, 1, 2600, 'Observatory Press', 1954, 'ฉบับพิมพ์จำกัดจำนวน มีลายเซ็นผู้เขียน', 'เล่มเดียวจบ', 1),
('ตำรายาไทยโบราณ ฉบับหายาก', 'คัดลอกจากต้นฉบับใบลาน', '/book-covers/book-962f4ee7.jpg', 'ตำราการแพทย์แผนไทยโบราณ คัดลอกจากต้นฉบับใบลาน เก็บรักษาในสภาพดีเยี่ยม', 4, 1, 1, 2000, 'คัดลอกจากต้นฉบับใบลาน', 1932, 'ฉบับคัดลอกจากใบลาน', 'เล่มเดียวจบ', 1);

-- ------------------------------------------------------------
-- หนังสือเพิ่มเติมรอบสอง (8 เล่ม ครบทุกหมวดหมู่ พร้อมรูปปกและรายละเอียดครบ)
-- ------------------------------------------------------------
INSERT INTO books (title, author, cover_image, description, book_type_id, total_copies, available_copies, price_value,
  publisher, publish_year, edition, volume, print_no) VALUES
('เงาฝันในสายลมหนาว', 'อรุณี ไพรวัลย์', '/book-covers/book-cf6555bc.jpg', 'นิยายดราม่าครอบครัวในหมู่บ้านเล็กๆ ทางภาคอีสาน ว่าด้วยลูกสาวที่กลับมาเยียวยาความสัมพันธ์กับพ่อหลังจากห่างหายไปนานสิบปี', 1, 3, 3, 210, 'สำนักพิมพ์ผีเสื้อ', 2023, 'ฉบับพิมพ์ครั้งแรก', 'เล่มเดียวจบ', 1),
('The Paper Cartographer', 'Nathaniel Voss', '/book-covers/the-paper-cartographer.jpg', 'นิยายผจญภัยยุคอาณานิคม ว่าด้วยนักทำแผนที่หนุ่มที่ออกเดินทางตามหาดินแดนที่ถูกลบออกจากแผนที่โลกทุกฉบับ', 1, 2, 2, 275, 'Lighthouse Press', 2022, 'ฉบับพิมพ์ครั้งแรก', 'เล่มเดียวจบ', 1),
('เพื่อนต่างดาวที่บ้านฉัน เล่ม 1', 'พีรดา วงศ์ไพศาล', '/book-covers/book-a510464a.jpg', 'การ์ตูนแนวไซไฟตลกสำหรับเด็ก ว่าด้วยเด็กประถมที่บังเอิญเจอมนุษย์ต่างดาวตัวจิ๋วตกยานมาซ่อนตัวอยู่ใต้เตียง', 2, 5, 5, 125, 'สำนักพิมพ์การ์ตูนไทย', 2023, 'ฉบับการ์ตูน', 'เล่ม 1', 1),
('Nightshade Academy: Vol. 1', 'Priya Anand', '/book-covers/nightshade-academy-vol-1.jpg', 'คอมมิคแฟนตาซีโรงเรียนเวทมนตร์ยามค่ำคืน ว่าด้วยนักเรียนใหม่ที่ต้องเรียนรู้เวทมนตร์เงาก่อนพระจันทร์เต็มดวงครั้งถัดไป', 2, 4, 4, 155, 'Ember Comics Studio', 2023, 'ฉบับการ์ตูน', 'เล่ม 1', 1),
('หลักการตลาดดิจิทัลยุคใหม่', 'ดร. ธนกร ศิริวัฒน์', '/book-covers/book-415a4add.jpg', 'ตำราการตลาดดิจิทัลที่ครอบคลุมตั้งแต่ SEO โฆษณาบนโซเชียลมีเดีย ไปจนถึงการวิเคราะห์ข้อมูลลูกค้า พร้อมกรณีศึกษาธุรกิจไทย', 3, 4, 4, 340, 'สำนักพิมพ์จุฬาลงกรณ์มหาวิทยาลัย', 2023, 'ฉบับปรับปรุงครั้งที่ 2', 'เล่มเดียวจบ', 2),
('Fundamentals of Environmental Science', 'Prof. Lena Marsh', '/book-covers/fundamentals-of-environmental-science.jpg', 'ตำราวิทยาศาสตร์สิ่งแวดล้อมเบื้องต้น ครอบคลุมระบบนิเวศ การเปลี่ยนแปลงสภาพภูมิอากาศ และแนวทางพัฒนาที่ยั่งยืน', 3, 3, 3, 410, 'Academic Press International', 2021, 'ฉบับปรับปรุงครั้งที่ 2', 'เล่มเดียวจบ', 2),
('สมุดข่อยโหราศาสตร์ไทยโบราณ', 'พระอาจารย์เมือง', '/book-covers/book-fcc9f133.jpg', 'ตำราโหราศาสตร์ไทยโบราณคัดลอกจากสมุดข่อยดั้งเดิม บันทึกตำราดูดวงและฤกษ์ยามแบบฉบับครูบาอาจารย์รุ่นเก่า', 4, 1, 1, 1900, 'คัดลอกจากสมุดข่อยดั้งเดิม', 1948, 'ฉบับคัดลอกจากสมุดข่อย', 'เล่มเดียวจบ', 1),
('Rare Manuscript: The Merchant\'s Ledger 1889', 'Unknown Author', '/book-covers/rare-manuscript-the-merchant-s-ledger-1889.jpg', 'บันทึกบัญชีการค้าของพ่อค้าสมัยรัชกาลที่ 5 หายากมาก บันทึกรายการซื้อขายสินค้าและเส้นทางเรือสำเภาในย่านท่าเรือกรุงเทพฯ', 4, 1, 1, 2900, 'ไม่ระบุสำนักพิมพ์ (ต้นฉบับลายมือ)', 1889, 'ต้นฉบับลายมือ ฉบับเดียวในโลก', 'เล่มเดียวจบ', 1);
