-- ============================================================
-- Migration v5: เพิ่มหนังสือ "ของจริง" 21 เล่ม (นิยาย/การ์ตูน/ตำรา/หนังสือสะสม) พร้อมข้อมูลครบ
-- รูปปกใช้แบบ "ลิงก์ตรงไปยัง Open Library" (https://covers.openlibrary.org/b/isbn/<ISBN>-L.jpg)
--   → ไม่ต้องดาวน์โหลดรูปลงเครื่อง เบราว์เซอร์ของผู้ใช้โหลดรูปจากเว็บเอง (ต้องมีอินเทอร์เน็ตตอนเปิดหน้าเว็บ)
--   → ถ้าเล่มไหนไม่มีรูปบน Open Library หรือเน็ตหลุด ระบบจะแสดงปกที่สร้างอัตโนมัติแทนเอง (ไม่เป็นรูปแตก)
-- ข้อมูลสำนักพิมพ์/ปีที่พิมพ์เป็นปีที่พิมพ์ครั้งแรกของผลงานและสำนักพิมพ์ของฉบับที่ใช้ปก — ควรตรวจกับเล่มจริงก่อนนำเสนอ
-- ใช้ได้ทั้งฐานข้อมูลใหม่และเก่า ต้องรันหลัง schema.sql / migration_v3.sql  (ปลอดภัยที่จะรันซ้ำ: ข้ามชื่อที่มีอยู่แล้ว)
-- รัน:  mysql -uroot --default-character-set=utf8mb4 < backend/database/migration_v5_real_books.sql
-- ============================================================
USE railway;
SET NAMES utf8mb4;

CREATE TEMPORARY TABLE __new_books_v5 (
  title VARCHAR(255), author VARCHAR(150), cover_image VARCHAR(255), description TEXT,
  book_type_id INT, total_copies INT, available_copies INT, price_value DECIMAL(10,2),
  publisher VARCHAR(150), publish_year INT, edition VARCHAR(150), volume VARCHAR(50), print_no INT
);

INSERT INTO __new_books_v5 VALUES
('1984', 'George Orwell', 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg', 'นิยายดิสโทเปียคลาสสิกว่าด้วยสังคมที่รัฐควบคุมความคิดและการสอดแนมทุกย่างก้าว ผ่านชีวิตของวินสตัน สมิธ ชายผู้เริ่มตั้งคำถามกับ "พี่เบิ้ม"', 1, 3, 3, 220, 'Signet Classics', 1949, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่มเดียวจบ', 1),
('Pride and Prejudice', 'Jane Austen', 'https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg', 'นิยายรักเสียดสีสังคมอังกฤษ ว่าด้วยเอลิซาเบธ เบนเน็ตกับมิสเตอร์ดาร์ซี ที่ต้องข้ามผ่านอคติและความหยิ่งทะนงของกันและกัน', 1, 3, 3, 210, 'Penguin Classics', 1813, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่มเดียวจบ', 1),
('The Great Gatsby', 'F. Scott Fitzgerald', 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg', 'นิยายยุคแจ๊สของอเมริกา เล่าเรื่องเศรษฐีลึกลับเจย์ แกตสบี และความฝันที่ไล่ตามไม่เคยถึง ผ่านสายตาของนิก แคร์ราเวย์', 1, 3, 3, 230, 'Scribner', 1925, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่มเดียวจบ', 1),
('To Kill a Mockingbird', 'Harper Lee', 'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg', 'นิยายว่าด้วยความอยุติธรรมทางเชื้อชาติในเมืองเล็กทางใต้ของสหรัฐฯ เล่าผ่านสายตาของสเคาท์ เด็กหญิงลูกสาวทนายความ', 1, 3, 3, 240, 'Harper Perennial', 1960, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่มเดียวจบ', 1),
('The Little Prince', 'Antoine de Saint-Exupéry', 'https://covers.openlibrary.org/b/isbn/9780156012195-L.jpg', 'วรรณกรรมเยาวชนที่ผู้ใหญ่ก็อ่านได้ ว่าด้วยเจ้าชายน้อยจากดาวดวงเล็กที่เดินทางไปพบผู้คนต่างๆ และบทเรียนเรื่องมิตรภาพกับความรัก', 1, 3, 3, 190, 'Harcourt', 1943, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่มเดียวจบ', 1),
('The Alchemist', 'Paulo Coelho', 'https://covers.openlibrary.org/b/isbn/9780062315007-L.jpg', 'นิยายเชิงปรัชญาว่าด้วยเด็กเลี้ยงแกะชาวสเปนที่ออกเดินทางตามหาขุมทรัพย์ และค้นพบว่าการเดินทางสำคัญกว่าจุดหมาย', 1, 3, 3, 230, 'HarperOne', 1988, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่มเดียวจบ', 1),
('Norwegian Wood', 'Haruki Murakami', 'https://covers.openlibrary.org/b/isbn/9780375704024-L.jpg', 'นิยายรักและความสูญเสียของวัยหนุ่มสาวในโตเกียวยุค 1960 เล่าผ่านความทรงจำของโทรุ วาตานาเบะ', 1, 3, 3, 250, 'Vintage', 1987, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่มเดียวจบ', 1),
('Maus I: A Survivor''s Tale', 'Art Spiegelman', 'https://covers.openlibrary.org/b/isbn/9780679406419-L.jpg', 'นิยายภาพบันทึกเรื่องราวของพ่อผู้รอดชีวิตจากเหตุการณ์ฮอโลคอสต์ โดยวาดเชื้อชาติต่างๆ เป็นสัตว์ ได้รับรางวัลพูลิตเซอร์พิเศษ', 2, 3, 3, 320, 'Pantheon', 1986, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่ม 1', 1),
('Persepolis: The Story of a Childhood', 'Marjane Satrapi', 'https://covers.openlibrary.org/b/isbn/9780375714832-L.jpg', 'การ์ตูนอัตชีวประวัติของหญิงสาวที่เติบโตในอิหร่านช่วงการปฏิวัติอิสลาม เล่าด้วยลายเส้นขาว-ดำที่เรียบง่ายแต่ทรงพลัง', 2, 3, 3, 300, 'Pantheon', 2000, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่ม 1', 1),
('Watchmen', 'Alan Moore', 'https://covers.openlibrary.org/b/isbn/9780930289232-L.jpg', 'กราฟิกโนเวลที่รื้อมุมมองเรื่องซูเปอร์ฮีโร่ในโลกที่ฮีโร่ถูกสั่งห้าม เมื่อมีการสืบสวนคดีฆาตกรรมอดีตสมาชิกทีม', 2, 3, 3, 420, 'DC Comics', 1987, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่มเดียวจบ', 1),
('Naruto, Vol. 1', 'Masashi Kishimoto', 'https://covers.openlibrary.org/b/isbn/9781569319000-L.jpg', 'มังงะแนวนินจาว่าด้วยนารูโตะ เด็กซนผู้ถูกรังเกียจเพราะผนึกจิ้งจอกเก้าหางไว้ในตัว และความฝันที่จะเป็นโฮคาเงะ', 2, 3, 3, 150, 'VIZ Media', 1999, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่ม 1', 1),
('One Piece, Vol. 1', 'Eiichiro Oda', 'https://covers.openlibrary.org/b/isbn/9781569319017-L.jpg', 'มังงะผจญภัยทะเลว่าด้วยลูฟี่ เด็กหนุ่มร่างกายยืดได้ที่ออกเดินเรือตามหาสมบัติวันพีซเพื่อเป็นราชาโจรสลัด', 2, 3, 3, 150, 'VIZ Media', 1997, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่ม 1', 1),
('Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', 'https://covers.openlibrary.org/b/isbn/9780062316110-L.jpg', 'หนังสือประวัติศาสตร์มนุษยชาติตั้งแต่ยุคหิน เกษตรกรรม จนถึงวิทยาศาสตร์สมัยใหม่ ที่ชวนตั้งคำถามว่าอะไรทำให้มนุษย์ครองโลก', 3, 3, 3, 450, 'Harper', 2011, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่มเดียวจบ', 1),
('A Brief History of Time', 'Stephen Hawking', 'https://covers.openlibrary.org/b/isbn/9780553380163-L.jpg', 'หนังสือวิทยาศาสตร์ยอดนิยมอธิบายจักรวาล หลุมดำ และธรรมชาติของเวลาด้วยภาษาที่คนทั่วไปเข้าใจได้', 3, 3, 3, 380, 'Bantam', 1988, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่มเดียวจบ', 1),
('Clean Code', 'Robert C. Martin', 'https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg', 'ตำราการเขียนโปรแกรมให้อ่านง่ายและดูแลรักษาได้ ว่าด้วยการตั้งชื่อ ฟังก์ชัน การจัดการข้อผิดพลาด และการรีแฟกเตอร์', 3, 3, 3, 900, 'Prentice Hall', 2008, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่มเดียวจบ', 1),
('Thinking, Fast and Slow', 'Daniel Kahneman', 'https://covers.openlibrary.org/b/isbn/9780374533557-L.jpg', 'หนังสือจิตวิทยาการตัดสินใจว่าด้วยระบบคิดเร็วแบบสัญชาตญาณกับระบบคิดช้าแบบใช้เหตุผล และอคติที่เกิดขึ้นกับเราทุกวัน', 3, 3, 3, 420, 'Farrar, Straus and Giroux', 2011, 'ฉบับพิมพ์ภาษาอังกฤษ', 'เล่มเดียวจบ', 1),
('Introduction to Algorithms', 'Thomas H. Cormen et al.', 'https://covers.openlibrary.org/b/isbn/9780262033848-L.jpg', 'ตำราอัลกอริทึมระดับมหาวิทยาลัยที่ใช้กันแพร่หลาย ครอบคลุมโครงสร้างข้อมูล การเรียงลำดับ กราฟ และการวิเคราะห์ความซับซ้อน', 3, 3, 3, 1500, 'MIT Press', 1990, 'ฉบับที่ 3', 'เล่มเดียวจบ', 3),
('The Hobbit', 'J.R.R. Tolkien', 'https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg', 'นิยายแฟนตาซีต้นกำเนิดมิดเดิลเอิร์ธ ว่าด้วยบิลโบ แบ๊กกินส์ฮอบบิทที่ถูกชวนไปผจญภัยชิงสมบัติจากมังกรสม็อก ฉบับสะสม', 4, 3, 3, 1500, 'Houghton Mifflin Harcourt', 1937, 'ฉบับสะสม', 'เล่มเดียวจบ', 1),
('Frankenstein', 'Mary Shelley', 'https://covers.openlibrary.org/b/isbn/9780486282114-L.jpg', 'นิยายสยองขวัญ-ไซไฟคลาสสิกว่าด้วยวิกเตอร์ แฟรงเกนสไตน์ ผู้สร้างสิ่งมีชีวิตจากร่างผู้ตายและต้องเผชิญผลของการกระทำนั้น ฉบับสะสม', 4, 3, 3, 1200, 'Dover Publications', 1818, 'ฉบับสะสม', 'เล่มเดียวจบ', 1),
('Dracula', 'Bram Stoker', 'https://covers.openlibrary.org/b/isbn/9780486411095-L.jpg', 'นิยายแวมไพร์ต้นแบบของวรรณกรรมสยองขวัญ เล่าผ่านจดหมายและบันทึกของตัวละครที่ร่วมกันไล่ล่าเคานต์แดรกคูลา ฉบับสะสม', 4, 3, 3, 1200, 'Dover Publications', 1897, 'ฉบับสะสม', 'เล่มเดียวจบ', 1),
('Alice''s Adventures in Wonderland', 'Lewis Carroll', 'https://covers.openlibrary.org/b/isbn/9780486275437-L.jpg', 'วรรณกรรมเยาวชนคลาสสิกว่าด้วยอลิซที่ตกลงไปในโพรงกระต่ายสู่ดินแดนมหัศจรรย์ที่เต็มไปด้วยตัวละครแปลกประหลาด ฉบับสะสม', 4, 3, 3, 1100, 'Dover Publications', 1865, 'ฉบับสะสม', 'เล่มเดียวจบ', 1);

INSERT INTO books (title, author, cover_image, description, book_type_id, total_copies, available_copies, price_value,
  publisher, publish_year, edition, volume, print_no)
SELECT n.title, n.author, n.cover_image, n.description, n.book_type_id, n.total_copies, n.available_copies, n.price_value,
  n.publisher, n.publish_year, n.edition, n.volume, n.print_no
FROM __new_books_v5 n
WHERE NOT EXISTS (SELECT 1 FROM books b WHERE b.title = n.title);

DROP TEMPORARY TABLE __new_books_v5;

-- (ไม่บังคับ) ลบหนังสือสาธิตชื่อสมมติทั้งหมดที่ยังไม่เคยถูกยืม เพื่อให้เหลือแต่หนังสือจริง — เอา -- ออกถ้าต้องการ
-- DELETE FROM books WHERE publisher IS NOT NULL AND cover_image LIKE '/book-covers/%'
--   AND id NOT IN (SELECT book_id FROM borrow_records);
