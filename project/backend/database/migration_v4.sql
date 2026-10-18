-- ============================================================
-- Migration v4: สำหรับฐานข้อมูลที่ deploy ไปแล้วเท่านั้น (ฐานข้อมูลใหม่ไม่ต้องรัน เพราะ schema.sql มีให้ครบแล้ว)
-- เพิ่มหนังสือใหม่อีก 8 เล่ม (ครบทุกหมวดหมู่ พร้อมรูปปกและรายละเอียดครบ: สำนักพิมพ์/ปีที่พิมพ์/ฉบับ/เล่มที่/พิมพ์ครั้งที่)
-- รันไฟล์นี้ผ่าน Railway Query tab หรือ mysql client ที่ต่อกับฐานข้อมูลเดิม
-- ต้องรันหลัง migration_v3.sql (ต้องมีคอลัมน์ publisher/publish_year/edition/volume/print_no อยู่ก่อนแล้ว)
-- ปลอดภัยที่จะรันซ้ำ — ใช้ตาราง __new_books_v4 ชั่วคราวกรองเฉพาะชื่อที่ยังไม่มีในระบบก่อนเพิ่ม
-- ============================================================
USE book_borrow_system;

CREATE TEMPORARY TABLE __new_books_v4 (
  title VARCHAR(255), author VARCHAR(150), cover_image VARCHAR(255), description TEXT,
  book_type_id INT, total_copies INT, available_copies INT, price_value DECIMAL(10,2),
  publisher VARCHAR(150), publish_year INT, edition VARCHAR(150), volume VARCHAR(50), print_no INT
);

INSERT INTO __new_books_v4 (title, author, cover_image, description, book_type_id, total_copies, available_copies, price_value,
  publisher, publish_year, edition, volume, print_no) VALUES
('เงาฝันในสายลมหนาว', 'อรุณี ไพรวัลย์', '/book-covers/book-cf6555bc.jpg', 'นิยายดราม่าครอบครัวในหมู่บ้านเล็กๆ ทางภาคอีสาน ว่าด้วยลูกสาวที่กลับมาเยียวยาความสัมพันธ์กับพ่อหลังจากห่างหายไปนานสิบปี', 1, 3, 3, 210, 'สำนักพิมพ์ผีเสื้อ', 2023, 'ฉบับพิมพ์ครั้งแรก', 'เล่มเดียวจบ', 1),
('The Paper Cartographer', 'Nathaniel Voss', '/book-covers/the-paper-cartographer.jpg', 'นิยายผจญภัยยุคอาณานิคม ว่าด้วยนักทำแผนที่หนุ่มที่ออกเดินทางตามหาดินแดนที่ถูกลบออกจากแผนที่โลกทุกฉบับ', 1, 2, 2, 275, 'Lighthouse Press', 2022, 'ฉบับพิมพ์ครั้งแรก', 'เล่มเดียวจบ', 1),
('เพื่อนต่างดาวที่บ้านฉัน เล่ม 1', 'พีรดา วงศ์ไพศาล', '/book-covers/book-a510464a.jpg', 'การ์ตูนแนวไซไฟตลกสำหรับเด็ก ว่าด้วยเด็กประถมที่บังเอิญเจอมนุษย์ต่างดาวตัวจิ๋วตกยานมาซ่อนตัวอยู่ใต้เตียง', 2, 5, 5, 125, 'สำนักพิมพ์การ์ตูนไทย', 2023, 'ฉบับการ์ตูน', 'เล่ม 1', 1),
('Nightshade Academy: Vol. 1', 'Priya Anand', '/book-covers/nightshade-academy-vol-1.jpg', 'คอมมิคแฟนตาซีโรงเรียนเวทมนตร์ยามค่ำคืน ว่าด้วยนักเรียนใหม่ที่ต้องเรียนรู้เวทมนตร์เงาก่อนพระจันทร์เต็มดวงครั้งถัดไป', 2, 4, 4, 155, 'Ember Comics Studio', 2023, 'ฉบับการ์ตูน', 'เล่ม 1', 1),
('หลักการตลาดดิจิทัลยุคใหม่', 'ดร. ธนกร ศิริวัฒน์', '/book-covers/book-415a4add.jpg', 'ตำราการตลาดดิจิทัลที่ครอบคลุมตั้งแต่ SEO โฆษณาบนโซเชียลมีเดีย ไปจนถึงการวิเคราะห์ข้อมูลลูกค้า พร้อมกรณีศึกษาธุรกิจไทย', 3, 4, 4, 340, 'สำนักพิมพ์จุฬาลงกรณ์มหาวิทยาลัย', 2023, 'ฉบับปรับปรุงครั้งที่ 2', 'เล่มเดียวจบ', 2),
('Fundamentals of Environmental Science', 'Prof. Lena Marsh', '/book-covers/fundamentals-of-environmental-science.jpg', 'ตำราวิทยาศาสตร์สิ่งแวดล้อมเบื้องต้น ครอบคลุมระบบนิเวศ การเปลี่ยนแปลงสภาพภูมิอากาศ และแนวทางพัฒนาที่ยั่งยืน', 3, 3, 3, 410, 'Academic Press International', 2021, 'ฉบับปรับปรุงครั้งที่ 2', 'เล่มเดียวจบ', 2),
('สมุดข่อยโหราศาสตร์ไทยโบราณ', 'พระอาจารย์เมือง', '/book-covers/book-fcc9f133.jpg', 'ตำราโหราศาสตร์ไทยโบราณคัดลอกจากสมุดข่อยดั้งเดิม บันทึกตำราดูดวงและฤกษ์ยามแบบฉบับครูบาอาจารย์รุ่นเก่า', 4, 1, 1, 1900, 'คัดลอกจากสมุดข่อยดั้งเดิม', 1948, 'ฉบับคัดลอกจากสมุดข่อย', 'เล่มเดียวจบ', 1),
('Rare Manuscript: The Merchant\'s Ledger 1889', 'Unknown Author', '/book-covers/rare-manuscript-the-merchant-s-ledger-1889.jpg', 'บันทึกบัญชีการค้าของพ่อค้าสมัยรัชกาลที่ 5 หายากมาก บันทึกรายการซื้อขายสินค้าและเส้นทางเรือสำเภาในย่านท่าเรือกรุงเทพฯ', 4, 1, 1, 2900, 'ไม่ระบุสำนักพิมพ์ (ต้นฉบับลายมือ)', 1889, 'ต้นฉบับลายมือ ฉบับเดียวในโลก', 'เล่มเดียวจบ', 1);
INSERT INTO books (title, author, cover_image, description, book_type_id, total_copies, available_copies, price_value,
  publisher, publish_year, edition, volume, print_no)
SELECT n.title, n.author, n.cover_image, n.description, n.book_type_id, n.total_copies, n.available_copies, n.price_value,
  n.publisher, n.publish_year, n.edition, n.volume, n.print_no
FROM __new_books_v4 n
WHERE NOT EXISTS (SELECT 1 FROM books b WHERE b.title = n.title);

DROP TEMPORARY TABLE __new_books_v4;
