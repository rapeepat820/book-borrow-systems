-- ============================================================
-- RP Bookstore — สร้างฐานข้อมูลใหม่ครบทุกตารางในไฟล์เดียว (รวม migration v2–v12 แล้ว)
-- ใช้กับฐานข้อมูลเปล่า (เช่น TiDB Cloud / MySQL ที่สร้างใหม่) — ห้ามรันซ้ำบนฐานข้อมูลที่มีตารางอยู่แล้ว
-- หลังรันเสร็จ ต้องตั้งรหัสผ่านแอดมินก่อนล็อกอิน (ดู MOVE-TO-RENDER.md ขั้นที่ 3)
-- ============================================================
SET NAMES utf8mb4;

CREATE TABLE `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `full_name` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `address_detail` varchar(255) DEFAULT NULL,
  `subdistrict` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `role` enum('customer','admin') NOT NULL DEFAULT 'customer',
  `status` enum('active','suspended') NOT NULL DEFAULT 'active',
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expires` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `refund_method` enum('promptpay','bank') DEFAULT NULL,
  `refund_bank` varchar(60) DEFAULT NULL,
  `refund_account_no` varchar(30) DEFAULT NULL,
  `refund_account_name` varchar(100) DEFAULT NULL,
  `id_verify_status` enum('unverified','pending','verified','rejected') NOT NULL DEFAULT 'unverified',
  `national_id_hash` char(64) DEFAULT NULL,
  `national_id_last4` char(4) DEFAULT NULL,
  `id_verified_at` datetime DEFAULT NULL,
  `id_reject_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `uq_users_national_id` (`national_id_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `book_types` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `type_name` varchar(100) NOT NULL,
  `borrow_days` INT NOT NULL DEFAULT 7,
  `deposit_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shipping_companies` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `base_fee` decimal(10,2) NOT NULL,
  `fee_per_book` decimal(10,2) NOT NULL DEFAULT 0.00,
  `delivery_days` INT NOT NULL,
  `tracking_url` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `base_weight_g` INT NOT NULL DEFAULT 1000,
  `fee_per_extra_kg` decimal(10,2) NOT NULL DEFAULT 0.00,
  `rate_provider` enum('manual','flash') NOT NULL DEFAULT 'manual',
  `markup_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shipping_boxes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` varchar(40) NOT NULL,
  `max_items` INT NOT NULL,
  `max_book_weight_g` INT NOT NULL,
  `length_cm` INT NOT NULL,
  `width_cm` INT NOT NULL,
  `height_cm` INT NOT NULL,
  `packaging_weight_g` INT NOT NULL DEFAULT 100,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `books` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `author` varchar(150) DEFAULT NULL,
  `cover_image` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `book_type_id` INT NOT NULL,
  `total_copies` INT NOT NULL DEFAULT 1,
  `available_copies` INT NOT NULL DEFAULT 1,
  `price_value` decimal(10,2) DEFAULT 0.00,
  `publisher` varchar(150) DEFAULT NULL,
  `publish_year` INT DEFAULT NULL,
  `edition` varchar(150) DEFAULT NULL,
  `volume` varchar(50) DEFAULT NULL,
  `print_no` INT DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `weight_g` INT NOT NULL DEFAULT 300,
  PRIMARY KEY (`id`),
  KEY `book_type_id` (`book_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `borrow_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `shipping_company_id` INT NOT NULL,
  `item_count` INT NOT NULL,
  `total_weight_g` INT NOT NULL,
  `shipping_fee` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_user` (`user_id`),
  KEY `fk_order_ship` (`shipping_company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `borrow_records` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `book_id` INT NOT NULL,
  `shipping_company_id` INT NOT NULL,
  `tracking_no` varchar(100) DEFAULT NULL,
  `shipping_address` text NOT NULL,
  `shipping_fee` decimal(10,2) NOT NULL,
  `deposit_amount` decimal(10,2) NOT NULL,
  `borrow_date` date NOT NULL,
  `due_date` date NOT NULL,
  `return_date` date DEFAULT NULL,
  `return_proof_image` varchar(255) DEFAULT NULL,
  `status` enum('pending_shipment','borrowing','return_requested','returned','overdue') NOT NULL DEFAULT 'pending_shipment',
  `shipping_status` enum('preparing','shipped','out_for_delivery','delivered') NOT NULL DEFAULT 'preparing',
  `deposit_refunded` tinyint(1) NOT NULL DEFAULT 0,
  `payment_status` enum('pending','pending_verification','paid') NOT NULL DEFAULT 'pending',
  `payment_method` enum('promptpay','cash') NOT NULL DEFAULT 'promptpay',
  `payment_slip_image` varchar(255) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `extend_requested_days` INT DEFAULT NULL,
  `extend_status` enum('none','pending','approved','rejected') NOT NULL DEFAULT 'none',
  `extend_fee` decimal(10,2) DEFAULT NULL,
  `extend_payment_status` enum('none','pending','pending_verification','paid') NOT NULL DEFAULT 'none',
  `extend_payment_slip_image` varchar(255) DEFAULT NULL,
  `extend_paid_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `late_fee` decimal(10,2) NOT NULL DEFAULT 0.00,
  `refund_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `refund_status` enum('none','pending','refunded') NOT NULL DEFAULT 'none',
  `refund_account_info` varchar(255) DEFAULT NULL,
  `refunded_at` datetime DEFAULT NULL,
  `refund_reference` varchar(100) DEFAULT NULL,
  `last_overdue_notice` date DEFAULT NULL,
  `order_id` INT DEFAULT NULL,
  `box_name` varchar(40) DEFAULT NULL,
  `parcel_weight_g` INT DEFAULT NULL,
  `shipping_rate_source` varchar(20) DEFAULT NULL,
  `shipping_cost_actual` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `book_id` (`book_id`),
  KEY `shipping_company_id` (`shipping_company_id`),
  KEY `idx_br_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payment_slips` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `trans_ref` varchar(64) NOT NULL,
  `sending_bank` char(3) DEFAULT NULL,
  `borrow_record_id` INT NOT NULL,
  `purpose` enum('borrow','extend') NOT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  `verify_mode` enum('auto','qr_only') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slip_trans_ref` (`trans_ref`),
  KEY `idx_slip_record` (`borrow_record_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `password_reset_otps` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `otp_hash` char(64) NOT NULL,
  `attempts` INT NOT NULL DEFAULT 0,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `contact_messages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `subject` varchar(120) NOT NULL,
  `message` text NOT NULL,
  `borrow_record_id` INT DEFAULT NULL,
  `status` enum('new','replied','closed') NOT NULL DEFAULT 'new',
  `admin_reply` text DEFAULT NULL,
  `replied_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contact_status` (`status`,`created_at`),
  KEY `idx_contact_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `site_settings` (
  `setting_key` varchar(50) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `book_reservations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `book_id` INT NOT NULL,
  `status` enum('waiting','ready','fulfilled','cancelled','expired') NOT NULL DEFAULT 'waiting',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `notified_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `fulfilled_record_id` INT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_res_book` (`book_id`,`status`,`created_at`),
  KEY `idx_res_user` (`user_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `id_verifications` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `id_hash` char(64) NOT NULL,
  `id_last4` char(4) NOT NULL,
  `id_number_enc` varbinary(255) DEFAULT NULL,
  `id_card_image` mediumblob DEFAULT NULL,
  `selfie_image` mediumblob DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` INT DEFAULT NULL,
  `reject_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_idv_status` (`status`,`created_at`),
  KEY `idx_idv_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ===== ข้อมูลตั้งต้น (ประเภทหนังสือ ขนส่ง กล่อง หนังสือตัวอย่าง และบัญชีแอดมิน) =====
/*M!999999\- enable the sandbox mode */ 
INSERT INTO `users` (`id`, `full_name`, `email`, `password_hash`, `phone`, `address`, `address_detail`, `subdistrict`, `district`, `province`, `postal_code`, `role`, `status`, `reset_token`, `reset_token_expires`, `created_at`, `refund_method`, `refund_bank`, `refund_account_no`, `refund_account_name`, `id_verify_status`, `national_id_hash`, `national_id_last4`, `id_verified_at`, `id_reject_reason`) VALUES (1,'ผู้ดูแลระบบ','admin@bookshop.local','$2b$10$replace_with_bcrypt_hash',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'admin','active',NULL,NULL,'2026-11-05 21:50:23',NULL,NULL,NULL,NULL,'verified',NULL,NULL,'2026-11-05 21:50:24',NULL);
INSERT INTO `book_types` (`id`, `type_name`, `borrow_days`, `deposit_amount`) VALUES (1,'นิยายทั่วไป',7,100.00);
INSERT INTO `book_types` (`id`, `type_name`, `borrow_days`, `deposit_amount`) VALUES (2,'การ์ตูน/คอมมิค',5,50.00);
INSERT INTO `book_types` (`id`, `type_name`, `borrow_days`, `deposit_amount`) VALUES (3,'ตำราเรียน/วิชาการ',14,300.00);
INSERT INTO `book_types` (`id`, `type_name`, `borrow_days`, `deposit_amount`) VALUES (4,'หนังสือหายาก/ราคาสูง',10,500.00);
INSERT INTO `shipping_companies` (`id`, `name`, `base_fee`, `fee_per_book`, `delivery_days`, `tracking_url`, `is_active`, `base_weight_g`, `fee_per_extra_kg`, `rate_provider`, `markup_percent`) VALUES (1,'Kerry Express',40.00,10.00,1,'https://th.kerryexpress.com/th/track/',1,1000,10.00,'manual',0.00);
INSERT INTO `shipping_companies` (`id`, `name`, `base_fee`, `fee_per_book`, `delivery_days`, `tracking_url`, `is_active`, `base_weight_g`, `fee_per_extra_kg`, `rate_provider`, `markup_percent`) VALUES (2,'ไปรษณีย์ไทย (EMS)',50.00,5.00,3,'https://track.thailandpost.co.th/',0,1000,5.00,'manual',0.00);
INSERT INTO `shipping_boxes` (`id`, `name`, `max_items`, `max_book_weight_g`, `length_cm`, `width_cm`, `height_cm`, `packaging_weight_g`, `is_active`, `sort_order`) VALUES (1,'กล่อง S (1-2 เล่ม)',2,1200,25,18,8,120,1,1);
INSERT INTO `shipping_boxes` (`id`, `name`, `max_items`, `max_book_weight_g`, `length_cm`, `width_cm`, `height_cm`, `packaging_weight_g`, `is_active`, `sort_order`) VALUES (2,'กล่อง M (3-4 เล่ม)',4,2500,32,24,12,180,1,2);
INSERT INTO `shipping_boxes` (`id`, `name`, `max_items`, `max_book_weight_g`, `length_cm`, `width_cm`, `height_cm`, `packaging_weight_g`, `is_active`, `sort_order`) VALUES (3,'กล่อง L (5 เล่ม)',5,4000,38,28,16,250,1,3);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (1,'The Quantum Future','Dr. Eliza Reed','/book-covers/the-quantum-future.jpg','สำรวจแนวคิดฟิสิกส์ควอนตัมที่จะเปลี่ยนอนาคตของเทคโนโลยีและชีวิตมนุษย์ อธิบายด้วยภาษาที่เข้าใจง่ายสำหรับผู้อ่านทั่วไป',1,3,3,350.00,'Aurora House Publishing',2021,'ฉบับพิมพ์ครั้งแรก','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (2,'Space and Light','Dr. Eliza Reed','/book-covers/space-and-light.jpg','หนังสือภาพถ่ายและบทความว่าด้วยความสัมพันธ์ระหว่างสถาปัตยกรรม แสง และพื้นที่ว่าง',1,2,2,420.00,'Aurora House Publishing',2020,'ฉบับปรับปรุง','เล่มเดียวจบ',2,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (3,'เสียงกระซิบจากขุนเขา','ปรียา ตันติวงศ์','/book-covers/book-f451ba13.jpg','นิยายดราม่าครอบครัวในหมู่บ้านเชิงเขาภาคเหนือ ว่าด้วยความลับที่ถูกฝังไว้สามชั่วอายุคน',1,3,3,220.00,'สำนักพิมพ์ประพันธ์สาส์น',2022,'ฉบับพิมพ์ครั้งแรก','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (4,'The Last Lighthouse Keeper','Martin Cole','/book-covers/the-last-lighthouse-keeper.jpg','นิยายว่าด้วยชายเฝ้าประภาคารคนสุดท้ายบนเกาะร้าง กับจดหมายลึกลับที่ลอยมาเกยฝั่งทุกเดือน',1,2,2,260.00,'Lighthouse Press',2019,'ฉบับพิมพ์ครั้งแรก','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (5,'ก่อนพรุ่งนี้จะมาถึง','ณัฐพงษ์ ศรีสุข','/book-covers/book-af9f1a54.jpg','เรื่องราวความรักและการเติบโตของกลุ่มเพื่อนวัยมัธยมในช่วงซัมเมอร์สุดท้ายก่อนแยกย้าย',1,4,4,190.00,'สำนักพิมพ์นานมีบุ๊คส์',2023,'ฉบับพิมพ์ครั้งแรก','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (6,'Midnight in Havoc City','Renée Castillo','/book-covers/midnight-in-havoc-city.jpg','นิยายสืบสวนสอบสวนแนวนัวร์ ตามรอยนักสืบเอกชนไขคดีฆาตกรรมในเมืองที่ไม่เคยหลับใหล',1,2,2,280.00,'Renard & Cole Publishing',2018,'ฉบับปรับปรุงครั้งที่ 2','เล่มเดียวจบ',3,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (7,'ทะเลไม่เคยจำใคร','อรุณ วิไลลักษณ์','/book-covers/book-deaabfe3.jpg','นิยายอิงชีวิตชุมชนชาวประมงชายฝั่งอันดามัน ก่อนและหลังภัยพิบัติครั้งใหญ่',1,3,3,240.00,'สำนักพิมพ์ผีเสื้อ',2021,'ฉบับพิมพ์ครั้งแรก','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (8,'นักสืบจิ๋วแห่งซอยเงียบ เล่ม 1','วาดโดย เมษ์ ศิลป์ไชย','/book-covers/book-54c4ae86.jpg','การ์ตูนสืบสวนสำหรับเด็กโต ตามติดแก๊งเพื่อนซี้ไขปริศนาในย่านที่พวกเขาอยู่',2,5,5,120.00,'สำนักพิมพ์การ์ตูนไทย',2022,'ฉบับการ์ตูน','เล่ม 1',2,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (9,'Starlight Squad: Origins','Art by Jules Renard','/book-covers/starlight-squad-origins.jpg','คอมมิคซูเปอร์ฮีโร่วัยรุ่นที่ต้องเรียนรู้พลังพิเศษไปพร้อมกับการสอบปลายภาค',2,4,4,150.00,'Ember Comics Studio',2021,'ฉบับการ์ตูน','เล่ม 1',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (10,'ร้านขนมของคุณยายมัตสึ เล่ม 1','อิลลัสเตรเตอร์: ฮารุกะ อิโต','/book-covers/book-a67ef033.jpg','การ์ตูนสไตล์ชีวิตประจำวัน บอกเล่าความอบอุ่นในร้านขนมเล็กๆ ริมทางรถไฟ',2,5,5,130.00,'สำนักพิมพ์ซากุระคอมมิค',2023,'ฉบับการ์ตูน','เล่ม 1',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (11,'The Iron Garden','Art by Lucas Bergman','/book-covers/the-iron-garden.jpg','คอมมิคไซไฟหลังหายนะ ว่าด้วยกลุ่มนักประดิษฐ์ที่พยายามฟื้นฟูโลกด้วยหุ่นยนต์เก่า',2,3,3,160.00,'Ember Comics Studio',2020,'ฉบับการ์ตูน','เล่มเดียวจบ',2,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (12,'ตำนานมังกรครึ่งฟ้า เล่ม 1','วาดโดย ทีมงาน Dragon Ink Studio','/book-covers/book-6e8b5721.jpg','การ์ตูนแฟนตาซีกำลังภายในไทย ว่าด้วยเด็กหนุ่มผู้ตื่นพลังมังกรโบราณ',2,4,4,140.00,'สำนักพิมพ์การ์ตูนไทย',2022,'ฉบับการ์ตูน','เล่ม 1',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (13,'Coffee and Constellations','Art by Min-jun Oh','/book-covers/coffee-and-constellations.jpg','คอมมิครวมเรื่องสั้นแนวโรแมนติกคอมเมดี้ เกิดขึ้นในร้านกาแฟที่เปิดเฉพาะกลางคืน',2,3,3,120.00,'Ember Comics Studio',2023,'ฉบับการ์ตูน','รวมเล่ม',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (14,'Mindful Leadership','Anong Suwan','/book-covers/mindful-leadership.jpg','จิตวิทยาการบริหารองค์กรใหม่ แนวทางการเป็นผู้นำอย่างมีสติในโลกที่เปลี่ยนแปลงรวดเร็ว',3,4,4,280.00,'Academic Press International',2020,'ฉบับพิมพ์ครั้งแรก','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (15,'หลักเศรษฐศาสตร์พฤติกรรมเบื้องต้น','ผศ.ดร. กิตติ ธนวัฒน์','/book-covers/book-15eada4b.jpg','ตำราแนะนำแนวคิดเศรษฐศาสตร์พฤติกรรม พร้อมกรณีศึกษาจากตลาดจริงในไทย',3,3,3,380.00,'สำนักพิมพ์จุฬาลงกรณ์มหาวิทยาลัย',2021,'ฉบับปรับปรุงครั้งที่ 2','เล่มเดียวจบ',3,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (16,'Introduction to Applied Statistics','Prof. Karen Whitfield','/book-covers/introduction-to-applied-statistics.jpg','ตำราสถิติประยุกต์สำหรับนักศึกษาสายวิทย์-สังคม เน้นตัวอย่างจากงานวิจัยจริง',3,3,3,420.00,'Academic Press International',2019,'ฉบับปรับปรุงครั้งที่ 3','เล่มเดียวจบ',4,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (17,'พื้นฐานการเขียนโปรแกรมเชิงวัตถุ','อ.ปิยะดา รุ่งเรือง','/book-covers/book-5a956f40.jpg','ตำราเรียนสำหรับผู้เริ่มต้นเขียนโปรแกรม อธิบายแนวคิด OOP ด้วยตัวอย่างภาษา Java',3,4,4,350.00,'สำนักพิมพ์มหาวิทยาลัยธรรมศาสตร์',2022,'ฉบับปรับปรุง','เล่มเดียวจบ',2,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (18,'A Concise History of Southeast Asia','Dr. Hendra Wibowo','/book-covers/a-concise-history-of-southeast-asia.jpg','ตำราประวัติศาสตร์เอเชียตะวันออกเฉียงใต้ฉบับย่อ ครอบคลุมตั้งแต่ยุคอาณาจักรโบราณถึงยุคปัจจุบัน',3,2,2,400.00,'Academic Press International',2018,'ฉบับพิมพ์ครั้งแรก','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (19,'จิตวิทยาการเรียนรู้สำหรับครู','รศ. สุนีย์ ภูมิพัฒน์','/book-covers/book-a545c380.jpg','ตำราจิตวิทยาการศึกษา เน้นทฤษฎีที่นำไปใช้ออกแบบการสอนในห้องเรียนจริง',3,3,3,320.00,'สำนักพิมพ์จุฬาลงกรณ์มหาวิทยาลัย',2020,'ฉบับปรับปรุงครั้งที่ 2','เล่มเดียวจบ',2,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (20,'บันทึกการเดินทาง ฉบับพิมพ์ครั้งแรก','หลวงวิจิตร บรรณาธิการ','/book-covers/book-a7ef8df1.jpg','หนังสือประวัติศาสตร์หายาก พิมพ์ครั้งแรก สภาพเก็บรักษาอย่างดี เหมาะสำหรับผู้สนใจประวัติศาสตร์ไทย',4,1,1,2200.00,'โรงพิมพ์หลวง',1968,'ฉบับพิมพ์ครั้งแรก (หายาก)','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (21,'First Edition: The Silent Atlas','Cartographer Wilhelm Kraus','/book-covers/first-edition-the-silent-atlas.jpg','หนังสือแผนที่โบราณฉบับพิมพ์ครั้งแรก รวบรวมแผนที่การเดินเรือศตวรรษที่ 19',4,1,1,3500.00,'Royal Cartographic Society',1897,'ฉบับพิมพ์ครั้งแรก (หายาก)','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (22,'กวีนิพนธ์ล้านนา ฉบับอนุรักษ์','ครูบาแสง วรรณคีรี','/book-covers/book-c5723b09.jpg','รวมกวีนิพนธ์ล้านนาโบราณ ถอดความและเรียบเรียงใหม่ พิมพ์จำนวนจำกัด',4,1,1,1800.00,'สำนักพิมพ์ล้านนาอนุรักษ์',1975,'ฉบับอนุรักษ์ พิมพ์จำกัดจำนวน','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (23,'Signed Copy: Letters from the Observatory','Dr. Sofia Marquez','/book-covers/signed-copy-letters-from-the-observatory.jpg','หนังสือวิทยาศาสตร์ดาราศาสตร์ พร้อมลายเซ็นผู้เขียน ฉบับพิมพ์จำกัดจำนวน',4,1,1,2600.00,'Observatory Press',1954,'ฉบับพิมพ์จำกัดจำนวน มีลายเซ็นผู้เขียน','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (24,'ตำรายาไทยโบราณ ฉบับหายาก','คัดลอกจากต้นฉบับใบลาน','/book-covers/book-962f4ee7.jpg','ตำราการแพทย์แผนไทยโบราณ คัดลอกจากต้นฉบับใบลาน เก็บรักษาในสภาพดีเยี่ยม',4,1,1,2000.00,'คัดลอกจากต้นฉบับใบลาน',1932,'ฉบับคัดลอกจากใบลาน','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (25,'เงาฝันในสายลมหนาว','อรุณี ไพรวัลย์','/book-covers/book-cf6555bc.jpg','นิยายดราม่าครอบครัวในหมู่บ้านเล็กๆ ทางภาคอีสาน ว่าด้วยลูกสาวที่กลับมาเยียวยาความสัมพันธ์กับพ่อหลังจากห่างหายไปนานสิบปี',1,3,3,210.00,'สำนักพิมพ์ผีเสื้อ',2023,'ฉบับพิมพ์ครั้งแรก','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (26,'The Paper Cartographer','Nathaniel Voss','/book-covers/the-paper-cartographer.jpg','นิยายผจญภัยยุคอาณานิคม ว่าด้วยนักทำแผนที่หนุ่มที่ออกเดินทางตามหาดินแดนที่ถูกลบออกจากแผนที่โลกทุกฉบับ',1,2,2,275.00,'Lighthouse Press',2022,'ฉบับพิมพ์ครั้งแรก','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (27,'เพื่อนต่างดาวที่บ้านฉัน เล่ม 1','พีรดา วงศ์ไพศาล','/book-covers/book-a510464a.jpg','การ์ตูนแนวไซไฟตลกสำหรับเด็ก ว่าด้วยเด็กประถมที่บังเอิญเจอมนุษย์ต่างดาวตัวจิ๋วตกยานมาซ่อนตัวอยู่ใต้เตียง',2,5,5,125.00,'สำนักพิมพ์การ์ตูนไทย',2023,'ฉบับการ์ตูน','เล่ม 1',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (28,'Nightshade Academy: Vol. 1','Priya Anand','/book-covers/nightshade-academy-vol-1.jpg','คอมมิคแฟนตาซีโรงเรียนเวทมนตร์ยามค่ำคืน ว่าด้วยนักเรียนใหม่ที่ต้องเรียนรู้เวทมนตร์เงาก่อนพระจันทร์เต็มดวงครั้งถัดไป',2,4,4,155.00,'Ember Comics Studio',2023,'ฉบับการ์ตูน','เล่ม 1',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (29,'หลักการตลาดดิจิทัลยุคใหม่','ดร. ธนกร ศิริวัฒน์','/book-covers/book-415a4add.jpg','ตำราการตลาดดิจิทัลที่ครอบคลุมตั้งแต่ SEO โฆษณาบนโซเชียลมีเดีย ไปจนถึงการวิเคราะห์ข้อมูลลูกค้า พร้อมกรณีศึกษาธุรกิจไทย',3,4,4,340.00,'สำนักพิมพ์จุฬาลงกรณ์มหาวิทยาลัย',2023,'ฉบับปรับปรุงครั้งที่ 2','เล่มเดียวจบ',2,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (30,'Fundamentals of Environmental Science','Prof. Lena Marsh','/book-covers/fundamentals-of-environmental-science.jpg','ตำราวิทยาศาสตร์สิ่งแวดล้อมเบื้องต้น ครอบคลุมระบบนิเวศ การเปลี่ยนแปลงสภาพภูมิอากาศ และแนวทางพัฒนาที่ยั่งยืน',3,3,3,410.00,'Academic Press International',2021,'ฉบับปรับปรุงครั้งที่ 2','เล่มเดียวจบ',2,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (31,'สมุดข่อยโหราศาสตร์ไทยโบราณ','พระอาจารย์เมือง','/book-covers/book-fcc9f133.jpg','ตำราโหราศาสตร์ไทยโบราณคัดลอกจากสมุดข่อยดั้งเดิม บันทึกตำราดูดวงและฤกษ์ยามแบบฉบับครูบาอาจารย์รุ่นเก่า',4,1,1,1900.00,'คัดลอกจากสมุดข่อยดั้งเดิม',1948,'ฉบับคัดลอกจากสมุดข่อย','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (32,'Rare Manuscript: The Merchant\'s Ledger 1889','Unknown Author','/book-covers/rare-manuscript-the-merchant-s-ledger-1889.jpg','บันทึกบัญชีการค้าของพ่อค้าสมัยรัชกาลที่ 5 หายากมาก บันทึกรายการซื้อขายสินค้าและเส้นทางเรือสำเภาในย่านท่าเรือกรุงเทพฯ',4,1,1,2900.00,'ไม่ระบุสำนักพิมพ์ (ต้นฉบับลายมือ)',1889,'ต้นฉบับลายมือ ฉบับเดียวในโลก','เล่มเดียวจบ',1,'2026-11-05 21:50:23',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (33,'1984','George Orwell','https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg','นิยายดิสโทเปียคลาสสิกว่าด้วยสังคมที่รัฐควบคุมความคิดและการสอดแนมทุกย่างก้าว ผ่านชีวิตของวินสตัน สมิธ ชายผู้เริ่มตั้งคำถามกับ \"พี่เบิ้ม\"',1,3,3,220.00,'Signet Classics',1949,'ฉบับพิมพ์ภาษาอังกฤษ','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (34,'Pride and Prejudice','Jane Austen','https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg','นิยายรักเสียดสีสังคมอังกฤษ ว่าด้วยเอลิซาเบธ เบนเน็ตกับมิสเตอร์ดาร์ซี ที่ต้องข้ามผ่านอคติและความหยิ่งทะนงของกันและกัน',1,3,3,210.00,'Penguin Classics',1813,'ฉบับพิมพ์ภาษาอังกฤษ','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (35,'The Great Gatsby','F. Scott Fitzgerald','https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg','นิยายยุคแจ๊สของอเมริกา เล่าเรื่องเศรษฐีลึกลับเจย์ แกตสบี และความฝันที่ไล่ตามไม่เคยถึง ผ่านสายตาของนิก แคร์ราเวย์',1,3,3,230.00,'Scribner',1925,'ฉบับพิมพ์ภาษาอังกฤษ','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (36,'To Kill a Mockingbird','Harper Lee','https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg','นิยายว่าด้วยความอยุติธรรมทางเชื้อชาติในเมืองเล็กทางใต้ของสหรัฐฯ เล่าผ่านสายตาของสเคาท์ เด็กหญิงลูกสาวทนายความ',1,3,3,240.00,'Harper Perennial',1960,'ฉบับพิมพ์ภาษาอังกฤษ','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (37,'The Little Prince','Antoine de Saint-Exupéry','https://covers.openlibrary.org/b/isbn/9780156012195-L.jpg','วรรณกรรมเยาวชนที่ผู้ใหญ่ก็อ่านได้ ว่าด้วยเจ้าชายน้อยจากดาวดวงเล็กที่เดินทางไปพบผู้คนต่างๆ และบทเรียนเรื่องมิตรภาพกับความรัก',1,3,3,190.00,'Harcourt',1943,'ฉบับพิมพ์ภาษาอังกฤษ','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (38,'The Alchemist','Paulo Coelho','https://covers.openlibrary.org/b/isbn/9780062315007-L.jpg','นิยายเชิงปรัชญาว่าด้วยเด็กเลี้ยงแกะชาวสเปนที่ออกเดินทางตามหาขุมทรัพย์ และค้นพบว่าการเดินทางสำคัญกว่าจุดหมาย',1,3,3,230.00,'HarperOne',1988,'ฉบับพิมพ์ภาษาอังกฤษ','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (39,'Norwegian Wood','Haruki Murakami','https://covers.openlibrary.org/b/isbn/9780375704024-L.jpg','นิยายรักและความสูญเสียของวัยหนุ่มสาวในโตเกียวยุค 1960 เล่าผ่านความทรงจำของโทรุ วาตานาเบะ',1,3,3,250.00,'Vintage',1987,'ฉบับพิมพ์ภาษาอังกฤษ','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (40,'Maus I: A Survivor\'s Tale','Art Spiegelman','https://covers.openlibrary.org/b/isbn/9780679406419-L.jpg','นิยายภาพบันทึกเรื่องราวของพ่อผู้รอดชีวิตจากเหตุการณ์ฮอโลคอสต์ โดยวาดเชื้อชาติต่างๆ เป็นสัตว์ ได้รับรางวัลพูลิตเซอร์พิเศษ',2,3,3,320.00,'Pantheon',1986,'ฉบับพิมพ์ภาษาอังกฤษ','เล่ม 1',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (41,'Persepolis: The Story of a Childhood','Marjane Satrapi','https://covers.openlibrary.org/b/isbn/9780375714832-L.jpg','การ์ตูนอัตชีวประวัติของหญิงสาวที่เติบโตในอิหร่านช่วงการปฏิวัติอิสลาม เล่าด้วยลายเส้นขาว-ดำที่เรียบง่ายแต่ทรงพลัง',2,3,3,300.00,'Pantheon',2000,'ฉบับพิมพ์ภาษาอังกฤษ','เล่ม 1',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (42,'Watchmen','Alan Moore','https://covers.openlibrary.org/b/isbn/9780930289232-L.jpg','กราฟิกโนเวลที่รื้อมุมมองเรื่องซูเปอร์ฮีโร่ในโลกที่ฮีโร่ถูกสั่งห้าม เมื่อมีการสืบสวนคดีฆาตกรรมอดีตสมาชิกทีม',2,3,3,420.00,'DC Comics',1987,'ฉบับพิมพ์ภาษาอังกฤษ','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (43,'Naruto, Vol. 1','Masashi Kishimoto','https://covers.openlibrary.org/b/isbn/9781569319000-L.jpg','มังงะแนวนินจาว่าด้วยนารูโตะ เด็กซนผู้ถูกรังเกียจเพราะผนึกจิ้งจอกเก้าหางไว้ในตัว และความฝันที่จะเป็นโฮคาเงะ',2,3,3,150.00,'VIZ Media',1999,'ฉบับพิมพ์ภาษาอังกฤษ','เล่ม 1',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (44,'One Piece, Vol. 1','Eiichiro Oda','https://covers.openlibrary.org/b/isbn/9781569319017-L.jpg','มังงะผจญภัยทะเลว่าด้วยลูฟี่ เด็กหนุ่มร่างกายยืดได้ที่ออกเดินเรือตามหาสมบัติวันพีซเพื่อเป็นราชาโจรสลัด',2,3,3,150.00,'VIZ Media',1997,'ฉบับพิมพ์ภาษาอังกฤษ','เล่ม 1',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (45,'Sapiens: A Brief History of Humankind','Yuval Noah Harari','https://covers.openlibrary.org/b/isbn/9780062316110-L.jpg','หนังสือประวัติศาสตร์มนุษยชาติตั้งแต่ยุคหิน เกษตรกรรม จนถึงวิทยาศาสตร์สมัยใหม่ ที่ชวนตั้งคำถามว่าอะไรทำให้มนุษย์ครองโลก',3,3,3,450.00,'Harper',2011,'ฉบับพิมพ์ภาษาอังกฤษ','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (46,'A Brief History of Time','Stephen Hawking','https://covers.openlibrary.org/b/isbn/9780553380163-L.jpg','หนังสือวิทยาศาสตร์ยอดนิยมอธิบายจักรวาล หลุมดำ และธรรมชาติของเวลาด้วยภาษาที่คนทั่วไปเข้าใจได้',3,3,3,380.00,'Bantam',1988,'ฉบับพิมพ์ภาษาอังกฤษ','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (47,'Clean Code','Robert C. Martin','https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg','ตำราการเขียนโปรแกรมให้อ่านง่ายและดูแลรักษาได้ ว่าด้วยการตั้งชื่อ ฟังก์ชัน การจัดการข้อผิดพลาด และการรีแฟกเตอร์',3,3,3,900.00,'Prentice Hall',2008,'ฉบับพิมพ์ภาษาอังกฤษ','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (48,'Thinking, Fast and Slow','Daniel Kahneman','https://covers.openlibrary.org/b/isbn/9780374533557-L.jpg','หนังสือจิตวิทยาการตัดสินใจว่าด้วยระบบคิดเร็วแบบสัญชาตญาณกับระบบคิดช้าแบบใช้เหตุผล และอคติที่เกิดขึ้นกับเราทุกวัน',3,3,3,420.00,'Farrar, Straus and Giroux',2011,'ฉบับพิมพ์ภาษาอังกฤษ','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (49,'Introduction to Algorithms','Thomas H. Cormen et al.','https://covers.openlibrary.org/b/isbn/9780262033848-L.jpg','ตำราอัลกอริทึมระดับมหาวิทยาลัยที่ใช้กันแพร่หลาย ครอบคลุมโครงสร้างข้อมูล การเรียงลำดับ กราฟ และการวิเคราะห์ความซับซ้อน',3,3,3,1500.00,'MIT Press',1990,'ฉบับที่ 3','เล่มเดียวจบ',3,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (50,'The Hobbit','J.R.R. Tolkien','https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg','นิยายแฟนตาซีต้นกำเนิดมิดเดิลเอิร์ธ ว่าด้วยบิลโบ แบ๊กกินส์ฮอบบิทที่ถูกชวนไปผจญภัยชิงสมบัติจากมังกรสม็อก ฉบับสะสม',4,3,3,1500.00,'Houghton Mifflin Harcourt',1937,'ฉบับสะสม','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (51,'Frankenstein','Mary Shelley','https://covers.openlibrary.org/b/isbn/9780486282114-L.jpg','นิยายสยองขวัญ-ไซไฟคลาสสิกว่าด้วยวิกเตอร์ แฟรงเกนสไตน์ ผู้สร้างสิ่งมีชีวิตจากร่างผู้ตายและต้องเผชิญผลของการกระทำนั้น ฉบับสะสม',4,3,3,1200.00,'Dover Publications',1818,'ฉบับสะสม','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (52,'Dracula','Bram Stoker','https://covers.openlibrary.org/b/isbn/9780486411095-L.jpg','นิยายแวมไพร์ต้นแบบของวรรณกรรมสยองขวัญ เล่าผ่านจดหมายและบันทึกของตัวละครที่ร่วมกันไล่ล่าเคานต์แดรกคูลา ฉบับสะสม',4,3,3,1200.00,'Dover Publications',1897,'ฉบับสะสม','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
INSERT INTO `books` (`id`, `title`, `author`, `cover_image`, `description`, `book_type_id`, `total_copies`, `available_copies`, `price_value`, `publisher`, `publish_year`, `edition`, `volume`, `print_no`, `created_at`, `weight_g`) VALUES (53,'Alice\'s Adventures in Wonderland','Lewis Carroll','https://covers.openlibrary.org/b/isbn/9780486275437-L.jpg','วรรณกรรมเยาวชนคลาสสิกว่าด้วยอลิซที่ตกลงไปในโพรงกระต่ายสู่ดินแดนมหัศจรรย์ที่เต็มไปด้วยตัวละครแปลกประหลาด ฉบับสะสม',4,3,3,1100.00,'Dover Publications',1865,'ฉบับสะสม','เล่มเดียวจบ',1,'2026-11-05 21:50:24',300);
