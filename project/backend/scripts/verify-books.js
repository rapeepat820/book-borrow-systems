// ตรวจ/แก้ข้อมูลหนังสือจริงกับ Open Library — รันบนเครื่องคุณเอง (ต้องต่ออินเทอร์เน็ต)
//
//   cd backend
//   node scripts/verify-books.js            # โหมดดูเฉยๆ: แสดงตารางเทียบข้อมูล ไม่แก้ฐานข้อมูล
//   node scripts/verify-books.js --apply    # อัปเดต cover_image เป็นลิงก์ปกที่ Open Library ยืนยันว่ามีจริง
//
// สคริปต์นี้ "ไม่ดาวน์โหลดรูป" เก็บเป็นลิงก์ (URL) ในคอลัมน์ cover_image เท่านั้น
// สำนักพิมพ์/ปีที่ Open Library คืนมามีหลายฉบับพิมพ์ จึงแสดงให้ดูเปรียบเทียบอย่างเดียว ไม่เขียนทับให้เอง
require('dotenv').config();
const pool = require('../config/db');

const APPLY = process.argv.includes('--apply');
const OL_COVER = 'https://covers.openlibrary.org/b/';

async function searchOpenLibrary(title, author) {
  // ตัดชื่อภาคย่อย/เล่ม เช่น "Naruto, Vol. 1" -> "Naruto" เพื่อให้ค้นเจอง่ายขึ้น
  const q = title.split(':')[0].replace(/,?\s*Vol\.?\s*\d+/i, '').trim();
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('title', q);
  if (author) url.searchParams.set('author', author.split(/[,&]/)[0].trim());
  url.searchParams.set('limit', '1');
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,publisher,isbn,cover_i');
  const res = await fetch(url, { headers: { 'User-Agent': 'book-borrow-verify/1.0 (student project)' } });
  if (!res.ok) throw new Error(`Open Library ตอบ ${res.status}`);
  const data = await res.json();
  return data.docs && data.docs[0];
}

(async () => {
  const [books] = await pool.query(
    "SELECT id, title, author, cover_image, publisher, publish_year FROM books WHERE cover_image LIKE 'https://covers.openlibrary.org/%' ORDER BY id"
  );
  console.log(`พบหนังสือที่ใช้ปกจาก Open Library ${books.length} เล่ม — โหมด: ${APPLY ? 'อัปเดตจริง' : 'ดูเฉยๆ (ใส่ --apply เพื่ออัปเดต)'}\n`);

  let updated = 0, notFound = 0;
  for (const b of books) {
    try {
      const doc = await searchOpenLibrary(b.title, b.author);
      if (!doc) { notFound++; console.log(`✗ [${b.id}] ${b.title} — ไม่พบใน Open Library`); continue; }
      const coverUrl = doc.cover_i ? `${OL_COVER}id/${doc.cover_i}-L.jpg` : null;
      console.log(`✓ [${b.id}] ${b.title}`);
      console.log(`    ใน Open Library : ${doc.title} — ${(doc.author_name || []).join(', ')} (พิมพ์ครั้งแรก ${doc.first_publish_year || '?'})`);
      console.log(`    ในฐานข้อมูล      : ${b.author} | ${b.publisher || '-'} | ${b.publish_year || '-'}`);
      console.log(`    สำนักพิมพ์ที่พบ  : ${(doc.publisher || []).slice(0, 3).join(' / ') || '-'}`);
      console.log(`    ปก               : ${coverUrl || 'ไม่มีปกให้ (จะใช้ปกที่เว็บสร้างให้)'}`);
      if (APPLY && coverUrl) {
        await pool.query('UPDATE books SET cover_image = ? WHERE id = ?', [coverUrl, b.id]);
        updated++;
      }
    } catch (err) {
      console.log(`! [${b.id}] ${b.title} — ผิดพลาด: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 600)); // เว้นจังหวะ ไม่ยิง API ถี่เกินไป
  }
  console.log(`\nเสร็จสิ้น: ไม่พบ ${notFound} เล่ม${APPLY ? `, อัปเดตปก ${updated} เล่ม` : ''}`);
  await pool.end();
})().catch(err => { console.error(err); process.exit(1); });
