// เติม "รูปปก + รายละเอียด" ให้หนังสือจาก API (Open Library + Google Books) อัตโนมัติ — รันบนเครื่องคุณ (ต้องต่ออินเทอร์เน็ต)
//
//  1) เติมข้อมูลที่ยังว่างของหนังสือที่มีอยู่แล้วในระบบ
//       cd backend
//       npm run enrich-books                    # ดูตัวอย่างก่อน (ยังไม่แก้ฐานข้อมูล)
//       npm run enrich-books -- --apply         # เติมจริง (เก็บปกเป็นลิงก์)
//       npm run enrich-books -- --apply --download   # เติมจริง + ดาวน์โหลดปกมาเก็บในเครื่อง (frontend/public/book-covers)
//       npm run enrich-books -- --apply --force      # เขียนทับข้อมูลเดิมด้วย (ปก/คำอธิบาย/สำนักพิมพ์/ปี)
//       npm run enrich-books -- --apply --id 5       # ทำเฉพาะหนังสือ id ที่ระบุ
//
//  2) เพิ่มหนังสือใหม่จากชื่อ (ระบบไปหาปก/ผู้แต่ง/เรื่องย่อ/สำนักพิมพ์/ปีให้เอง) ต้องระบุประเภท --type
//       npm run enrich-books -- --type 1 --copies 3 "Dune" "The Martian" "Atomic Habits" --apply
//       (id ประเภทดูได้จากตาราง book_types หรือหน้าแอดมิน "ประเภทหนังสือ")
//       ใส่ ISBN แทนชื่อก็ได้ เช่น "isbn:9780441172719"
//
// โดยปกติจะเติมเฉพาะช่องที่ "ว่าง" หรือ "ปกเสีย" เท่านั้น ไม่เขียนทับของที่แอดมินใส่ไว้ (ยกเว้นใส่ --force)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { lookupBook, coverWorks, downloadCover } = require('../utils/bookLookup');
const { ensureColumns } = require('../utils/bookAutoSetup');

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const option = name => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = flag('apply');
const DOWNLOAD = flag('download');
const FORCE = flag('force');
const ONLY_ID = option('id');
const TYPE_ID = option('type');
const COPIES = Number(option('copies') || 3);
// ชื่อหนังสือใหม่ = argument ที่ไม่ใช่ --flag และไม่ใช่ค่าของ --id/--type/--copies
const VALUE_OPTIONS = ['--id', '--type', '--copies'];
const NEW_TITLES = args.filter((a, i) => !a.startsWith('--') && !VALUE_OPTIONS.includes(args[i - 1]));

const COVER_DIR = path.join(__dirname, '..', '..', 'frontend', 'public', 'book-covers');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isEmpty = v => v === null || v === undefined || String(v).trim() === '';

function slugify(text, fallback) {
  const s = String(text || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return s || fallback;
}

// เก็บปก: ถ้า --download จะโหลดรูปมาเก็บในเครื่องแล้วคืน path เช่น /book-covers/dune.jpg, ไม่งั้นคืนลิงก์เดิม
async function storeCover(url, slug) {
  if (!url || !DOWNLOAD) return url;
  const buf = await downloadCover(url);
  if (!buf) return url; // โหลดไม่ได้ก็เก็บเป็นลิงก์แทน
  if (APPLY) {
    fs.mkdirSync(COVER_DIR, { recursive: true });
    fs.writeFileSync(path.join(COVER_DIR, `${slug}.jpg`), buf);
  }
  return `/book-covers/${slug}.jpg`;
}

// ปกปัจจุบันใช้ได้ไหม (ว่าง / ไฟล์ในเครื่องหาย / ลิงก์ภายนอกเสีย = ใช้ไม่ได้)
async function currentCoverOk(cover) {
  if (isEmpty(cover)) return false;
  if (cover.startsWith('/book-covers/')) return fs.existsSync(path.join(COVER_DIR, path.basename(cover)));
  if (cover.startsWith('/uploads/')) return true; // ไฟล์ที่แอดมินอัปโหลดเอง ไม่ยุ่ง
  if (/^https?:\/\//.test(cover)) return coverWorks(cover);
  return false;
}

async function enrichExisting() {
  let sql = 'SELECT id, title, author, cover_image, description, publisher, publish_year FROM books';
  const params = [];
  if (ONLY_ID) { sql += ' WHERE id = ?'; params.push(ONLY_ID); }
  sql += ' ORDER BY id';
  const [books] = await pool.query(sql, params);
  console.log(`หนังสือในระบบ ${books.length} เล่ม — โหมด: ${APPLY ? 'เติมจริง' : 'ดูตัวอย่าง (ใส่ --apply เพื่อเติมจริง)'}${DOWNLOAD ? ' + ดาวน์โหลดปก' : ''}${FORCE ? ' + เขียนทับ' : ''}\n`);

  const stat = { updated: 0, skipped: 0, notFound: 0, error: 0 };
  for (const b of books) {
    try {
      const coverOk = await currentCoverOk(b.cover_image);
      const needs = {
        cover: FORCE || !coverOk,
        description: FORCE || isEmpty(b.description),
        publisher: FORCE || isEmpty(b.publisher),
        year: FORCE || isEmpty(b.publish_year)
      };
      if (!Object.values(needs).some(Boolean)) { stat.skipped++; continue; }

      const info = await lookupBook({ title: b.title, author: b.author });
      if (!info) { stat.notFound++; console.log(`✗ [${b.id}] ${b.title} — ไม่พบใน API`); await sleep(500); continue; }

      const changes = {};
      if (needs.cover && info.cover_image) changes.cover_image = await storeCover(info.cover_image, slugify(b.title, `book-${b.id}`));
      if (needs.description && info.description) changes.description = info.description;
      if (needs.publisher && info.publisher) changes.publisher = info.publisher;
      if (needs.year && info.publish_year) changes.publish_year = info.publish_year;

      if (Object.keys(changes).length === 0) { stat.notFound++; console.log(`✗ [${b.id}] ${b.title} — พบเล่มแต่ไม่มีข้อมูลที่ขาดอยู่`); await sleep(500); continue; }

      console.log(`✓ [${b.id}] ${b.title}  (${info.source})`);
      for (const [k, v] of Object.entries(changes)) console.log(`    + ${k}: ${String(v).slice(0, 90)}${String(v).length > 90 ? '…' : ''}`);

      if (APPLY) {
        const cols = Object.keys(changes).map(k => `${k} = ?`).join(', ');
        await pool.query(`UPDATE books SET ${cols} WHERE id = ?`, [...Object.values(changes), b.id]);
      }
      stat.updated++;
    } catch (err) {
      stat.error++;
      console.log(`! [${b.id}] ${b.title} — ผิดพลาด: ${err.message}`);
    }
    await sleep(600); // เว้นจังหวะ ไม่ยิง API ถี่เกินไป
  }
  console.log(`\nเสร็จสิ้น: ${APPLY ? 'เติม' : 'จะเติม'} ${stat.updated} เล่ม | ข้อมูลครบแล้ว ${stat.skipped} | ไม่พบ ${stat.notFound} | ผิดพลาด ${stat.error}`);
  if (!APPLY && stat.updated) console.log('ถ้าพอใจผลข้างบน รันซ้ำพร้อม --apply เพื่อบันทึกลงฐานข้อมูล');
}

async function addNew() {
  if (!TYPE_ID) throw new Error('การเพิ่มหนังสือใหม่ต้องระบุประเภทด้วย --type <id> (ดู id ในตาราง book_types)');
  const [[type]] = await pool.query('SELECT id, type_name FROM book_types WHERE id = ?', [TYPE_ID]);
  if (!type) throw new Error(`ไม่พบประเภทหนังสือ id=${TYPE_ID}`);
  console.log(`เพิ่มหนังสือใหม่ ${NEW_TITLES.length} เล่ม ประเภท "${type.type_name}" เล่มละ ${COPIES} สำเนา — โหมด: ${APPLY ? 'เพิ่มจริง' : 'ดูตัวอย่าง (ใส่ --apply เพื่อเพิ่มจริง)'}\n`);

  for (const input of NEW_TITLES) {
    try {
      const isbnMatch = input.match(/^isbn:(.+)$/i);
      const info = await lookupBook(isbnMatch ? { isbn: isbnMatch[1] } : { title: input });
      if (!info) { console.log(`✗ "${input}" — ไม่พบใน API`); continue; }
      const [dup] = await pool.query('SELECT id FROM books WHERE title = ?', [info.title]);
      if (dup.length) { console.log(`- "${info.title}" มีในระบบแล้ว (id ${dup[0].id}) ข้าม`); continue; }

      const cover = await storeCover(info.cover_image, slugify(info.title, `book-${Date.now()}`));
      console.log(`✓ ${info.title} — ${info.author || '-'} | ${info.publisher || '-'} | ${info.publish_year || '-'} | ปก: ${cover ? 'มี' : 'ไม่มี (ระบบสร้างปกให้เอง)'} | เรื่องย่อ: ${info.description ? 'มี' : 'ไม่มี'}`);
      if (APPLY) {
        await pool.query(
          `INSERT INTO books (title, author, cover_image, description, book_type_id, total_copies, available_copies, price_value,
             publisher, publish_year, edition, volume, print_no)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, 'เล่มเดียวจบ', 1)`,
          [info.title, info.author, cover, info.description, type.id, COPIES, COPIES, info.publisher, info.publish_year]
        );
      }
    } catch (err) {
      console.log(`! "${input}" — ผิดพลาด: ${err.message}`);
    }
    await sleep(600);
  }
  if (APPLY) console.log('\nเพิ่มเสร็จแล้ว — มูลค่าหนังสือตั้งไว้ 0 บาท ไปแก้ในหน้าแอดมินได้');
}

(async () => {
  await ensureColumns(pool); // กันกรณีฐานข้อมูลเก่ายังไม่มีคอลัมน์ปีที่พิมพ์/ฉบับ/เล่ม
  if (NEW_TITLES.length) await addNew();
  else await enrichExisting();
  await pool.end();
})().catch(async err => { console.error('ผิดพลาด:', err.message); await pool.end().catch(() => {}); process.exit(1); });
