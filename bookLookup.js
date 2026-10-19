// ค้นหาข้อมูลหนังสือ (ปก/คำอธิบาย/สำนักพิมพ์/ปีที่พิมพ์) จาก API สาธารณะ ไม่ต้องใช้ API key
//   - Open Library  : ปก + ผู้แต่ง + สำนักพิมพ์ + ปี   (https://openlibrary.org/developers/api)
//   - Google Books  : คำอธิบายเรื่องย่อ + ปกสำรอง      (https://developers.google.com/books)
// ใช้ร่วมกันระหว่างสคริปต์ (scripts/enrich-books.js) และหน้าแอดมิน (GET /api/admin/books/lookup)
// ต้องใช้ Node 18+ (มี fetch ในตัว)

const UA = 'book-borrow-system/1.0 (student project)';
const TIMEOUT_MS = 10000;

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`${new URL(url).host} ตอบ ${res.status}`);
  return res.json();
}

// ตัดส่วนที่ทำให้ค้นยาก เช่น "Naruto, Vol. 1" -> "Naruto", "Maus I: A Survivor's Tale" -> "Maus I"
function cleanTitle(title) {
  return String(title || '').split(':')[0].replace(/,?\s*Vol\.?\s*\d+/i, '').trim();
}
function firstAuthor(author) {
  return String(author || '').split(/[,&]|\bet al\.?/i)[0].trim();
}
function cleanIsbn(isbn) {
  return String(isbn || '').replace(/[^0-9Xx]/g, '');
}

async function fromOpenLibrary({ title, author, isbn }) {
  const url = new URL('https://openlibrary.org/search.json');
  const cleaned = cleanIsbn(isbn);
  if (cleaned) {
    url.searchParams.set('isbn', cleaned);
  } else {
    url.searchParams.set('title', cleanTitle(title));
    if (firstAuthor(author)) url.searchParams.set('author', firstAuthor(author));
  }
  url.searchParams.set('limit', '5');
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,publisher,isbn,cover_i,subject');
  const data = await getJson(url);
  const docs = data.docs || [];
  // เลือกเล่มที่มีปกก่อน (ผลลัพธ์แรกมักไม่มีปกถ้าเป็นฉบับแปลก ๆ)
  return docs.find(d => d.cover_i) || docs[0] || null;
}

async function fromGoogleBooks({ title, author, isbn }) {
  const cleaned = cleanIsbn(isbn);
  const q = cleaned
    ? `isbn:${cleaned}`
    : `intitle:${cleanTitle(title)}${firstAuthor(author) ? `+inauthor:${firstAuthor(author)}` : ''}`;
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', q);
  url.searchParams.set('maxResults', '5');
  url.searchParams.set('printType', 'books');
  const data = await getJson(url);
  const items = data.items || [];
  // เลือกเล่มที่มีเรื่องย่อก่อน
  const best = items.find(i => i.volumeInfo && i.volumeInfo.description) || items[0];
  return best ? best.volumeInfo : null;
}

function googleCoverUrl(info) {
  const link = info && info.imageLinks && (info.imageLinks.large || info.imageLinks.medium || info.imageLinks.thumbnail);
  if (!link) return null;
  return link.replace(/^http:/, 'https:').replace('&edge=curl', '').replace('zoom=1', 'zoom=2');
}

function yearFrom(text) {
  const m = String(text || '').match(/\d{4}/);
  return m ? Number(m[0]) : null;
}

/**
 * ค้นหาข้อมูลหนังสือ คืนค่า object ที่พร้อมใส่ฟอร์ม/ฐานข้อมูล หรือ null ถ้าไม่พบเลย
 * ถ้า API ตัวใดตัวหนึ่งล่ม จะใช้ผลของอีกตัวแทน (ไม่ throw ถ้ายังได้ข้อมูลจากอีกตัว)
 */
async function lookupBook({ title, author, isbn }) {
  const [ol, gb] = await Promise.allSettled([
    fromOpenLibrary({ title, author, isbn }),
    fromGoogleBooks({ title, author, isbn })
  ]);
  const olDoc = ol.status === 'fulfilled' ? ol.value : null;
  const gbInfo = gb.status === 'fulfilled' ? gb.value : null;

  if (!olDoc && !gbInfo) {
    if (ol.status === 'rejected' && gb.status === 'rejected') {
      throw new Error(`เรียก API ไม่สำเร็จ (${ol.reason.message}; ${gb.reason.message})`);
    }
    return null;
  }

  const cover_image = olDoc && olDoc.cover_i
    ? `https://covers.openlibrary.org/b/id/${olDoc.cover_i}-L.jpg`
    : googleCoverUrl(gbInfo);

  return {
    title: (olDoc && olDoc.title) || (gbInfo && gbInfo.title) || title,
    author: (olDoc && (olDoc.author_name || []).join(', ')) || (gbInfo && (gbInfo.authors || []).join(', ')) || author || null,
    cover_image: cover_image || null,
    description: (gbInfo && gbInfo.description) ? String(gbInfo.description).replace(/<[^>]+>/g, '').trim() : null,
    publisher: (gbInfo && gbInfo.publisher) || (olDoc && (olDoc.publisher || [])[0]) || null,
    publish_year: (olDoc && olDoc.first_publish_year) || yearFrom(gbInfo && gbInfo.publishedDate),
    isbn: (olDoc && (olDoc.isbn || [])[0]) || null,
    source: [olDoc ? 'Open Library' : null, gbInfo ? 'Google Books' : null].filter(Boolean).join(' + ')
  };
}

// รูปนี้ใช้ได้จริงไหม (ไม่ใช่ 404 / ไม่ใช่รูปว่าง 1x1 ที่ Open Library ส่งกลับเมื่อไม่มีปก)
async function coverWorks(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'covers.openlibrary.org') u.searchParams.set('default', 'false');
    const res = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 2000; // รูปว่าง/placeholder เล็กกว่านี้มาก
  } catch {
    return false;
  }
}

// ดาวน์โหลดรูปปกเป็น Buffer (คืน null ถ้าโหลดไม่ได้หรือไม่ใช่รูปจริง)
async function downloadCover(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS * 2) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 2000 ? buf : null;
  } catch {
    return null;
  }
}

module.exports = { lookupBook, coverWorks, downloadCover };
