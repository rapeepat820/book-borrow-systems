// ติดตั้ง/ซ่อมข้อมูลหนังสืออัตโนมัติ — เรียกตอนเปิดเซิร์ฟเวอร์ และจากปุ่มในหน้าแอดมิน
// ปลอดภัยที่จะรันซ้ำ: เติมเฉพาะช่องที่ "ว่าง" หรือ "ปกที่ไฟล์หาย" ไม่เขียนทับข้อมูลที่แอดมินใส่ไว้
//
//  ขั้น 1  ตรวจว่าตาราง books มีคอลัมน์ publisher / publish_year / edition / volume / print_no (ไม่มีก็เพิ่มให้)
//  ขั้น 2  จับคู่ชื่อหนังสือกับรูปปกในโฟลเดอร์ frontend/public/book-covers + ข้อมูลสำนักพิมพ์/ปี/ฉบับ/เล่ม (ไม่ใช้อินเทอร์เน็ต)
//  ขั้น 3  เล่มที่ยังขาด → ไปดึงจาก Open Library + Google Books (ต้องมีอินเทอร์เน็ต ทำเบื้องหลังทีละเล่ม)
const fs = require('fs');
const path = require('path');
const { lookupBook } = require('./bookLookup');

const seedMap = require('../database/book-seed-map.json');
const COVER_DIRS = [
  path.join(__dirname, '..', '..', 'frontend', 'public', 'book-covers'),
  path.join(__dirname, '..', '..', 'frontend', 'dist', 'book-covers')
];
const NEEDED_COLUMNS = [
  ['publisher', 'VARCHAR(150) NULL'],
  ['publish_year', 'INT NULL'],
  ['edition', 'VARCHAR(150) NULL'],
  ['volume', 'VARCHAR(50) NULL'],
  ['print_no', 'INT NULL']
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const isEmpty = v => v === null || v === undefined || String(v).trim() === '';
const coverFileExists = p => COVER_DIRS.some(d => fs.existsSync(path.join(d, path.basename(p))));

// สถานะล่าสุด ให้หน้าแอดมินมาถามได้
const status = { running: false, step: '', done: 0, total: 0, localFilled: 0, apiFilled: 0, message: '', finishedAt: null };
const getStatus = () => ({ ...status });

async function ensureColumns(pool) {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books'`
  );
  const have = new Set(cols.map(c => c.COLUMN_NAME));
  let added = 0;
  for (const [name, def] of NEEDED_COLUMNS) {
    if (!have.has(name)) { await pool.query(`ALTER TABLE books ADD COLUMN ${name} ${def}`); added++; }
  }
  return added;
}

// "Naruto, Vol. 3" / "ตำนานมังกร เล่ม 2" → "เล่ม 3" / "เล่ม 2"; ไม่มีเลขในชื่อ → "เล่มเดียวจบ"
function guessVolume(title) {
  const m = String(title || '').match(/(?:เล่ม|vol\.?|volume)\s*(\d+)/i);
  return m ? `เล่ม ${m[1]}` : 'เล่มเดียวจบ';
}

async function fillFromSeed(pool) {
  const [books] = await pool.query('SELECT id, title, cover_image, publisher, publish_year, edition, volume, print_no FROM books');
  let filled = 0;
  for (const b of books) {
    const changes = {};
    const seedCover = seedMap.covers[b.title];
    const coverBad = isEmpty(b.cover_image) || (b.cover_image.startsWith('/book-covers/') && !coverFileExists(b.cover_image));
    if (coverBad && seedCover && (/^https?:/.test(seedCover) || coverFileExists(seedCover))) changes.cover_image = seedCover;

    const d = seedMap.details[b.title] || {};
    for (const k of ['publisher', 'publish_year', 'edition', 'volume', 'print_no']) {
      if (isEmpty(b[k]) && !isEmpty(d[k])) changes[k] = d[k];
    }
    if (isEmpty(b.volume) && isEmpty(changes.volume)) changes.volume = guessVolume(b.title);

    if (Object.keys(changes).length) {
      const set = Object.keys(changes).map(k => `${k} = ?`).join(', ');
      await pool.query(`UPDATE books SET ${set} WHERE id = ?`, [...Object.values(changes), b.id]);
      filled++;
    }
  }
  return filled;
}

async function fillFromApi(pool, log) {
  const [books] = await pool.query('SELECT id, title, author, cover_image, description, publisher, publish_year FROM books ORDER BY id');
  const todo = books.filter(b => {
    const coverBad = isEmpty(b.cover_image) || (b.cover_image.startsWith('/book-covers/') && !coverFileExists(b.cover_image));
    return coverBad || isEmpty(b.description) || isEmpty(b.publisher) || isEmpty(b.publish_year);
  });
  status.total = todo.length; status.done = 0;
  let filled = 0, consecutiveErrors = 0;
  for (const b of todo) {
    try {
      const info = await lookupBook({ title: b.title, author: b.author });
      consecutiveErrors = 0;
      if (info) {
        const changes = {};
        const coverBad = isEmpty(b.cover_image) || (b.cover_image.startsWith('/book-covers/') && !coverFileExists(b.cover_image));
        if (coverBad && info.cover_image) changes.cover_image = info.cover_image;
        if (isEmpty(b.description) && info.description) changes.description = info.description;
        if (isEmpty(b.publisher) && info.publisher) changes.publisher = info.publisher;
        if (isEmpty(b.publish_year) && info.publish_year) changes.publish_year = info.publish_year;
        if (Object.keys(changes).length) {
          const set = Object.keys(changes).map(k => `${k} = ?`).join(', ');
          await pool.query(`UPDATE books SET ${set} WHERE id = ?`, [...Object.values(changes), b.id]);
          filled++;
        }
      }
    } catch (err) {
      // ต่ออินเทอร์เน็ตไม่ได้ติดกัน 3 ครั้ง = หยุด ไม่วนต่อให้เสียเวลา
      if (++consecutiveErrors >= 3) { log(`[books] ต่อ API ค้นหาหนังสือไม่ได้ (${err.message}) — หยุดขั้นดึงจากอินเทอร์เน็ต`); break; }
    }
    status.done++;
    await sleep(600);
  }
  return filled;
}

async function runAutoSetup(pool, { useApi = true, log = console.log } = {}) {
  if (status.running) return getStatus();
  Object.assign(status, { running: true, step: 'เตรียมฐานข้อมูล', done: 0, total: 0, localFilled: 0, apiFilled: 0, message: '' });
  try {
    const added = await ensureColumns(pool);
    if (added) log(`[books] เพิ่มคอลัมน์ที่ขาดในตาราง books ${added} คอลัมน์`);

    status.step = 'จับคู่รูปปกและข้อมูลที่มีในระบบ';
    status.localFilled = await fillFromSeed(pool);
    if (status.localFilled) log(`[books] เติมปก/รายละเอียดจากข้อมูลในระบบ ${status.localFilled} เล่ม`);

    if (useApi) {
      status.step = 'ดึงข้อมูลจากอินเทอร์เน็ต';
      status.apiFilled = await fillFromApi(pool, log);
      if (status.apiFilled) log(`[books] ดึงปก/รายละเอียดจากอินเทอร์เน็ต ${status.apiFilled} เล่ม`);
    }
    status.message = `เสร็จแล้ว: เติมจากข้อมูลในระบบ ${status.localFilled} เล่ม, จากอินเทอร์เน็ต ${status.apiFilled} เล่ม`;
  } catch (err) {
    status.message = `ผิดพลาด: ${err.message}`;
    log(`[books] ${status.message}`);
  } finally {
    status.running = false; status.step = ''; status.finishedAt = new Date().toISOString();
  }
  return getStatus();
}

module.exports = { runAutoSetup, getStatus, ensureColumns };
