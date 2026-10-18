import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getSession } from '../api';
import BookCard from '../components/BookCard';
import SectionTitle from '../components/SectionTitle';
import CategoryPickerModal from '../components/CategoryPickerModal';
import { BookGridSkeleton } from '../components/Skeleton';
import useFavorites from '../hooks/useFavorites';
import { gradientFor } from '../utils/coverArt';
import {
  SearchIcon, HistoryIcon, UserIcon, ChevronRightIcon, BookStackIcon, GridIcon, SparkleIcon,
  ChevronDownIcon, HeartIcon, AlertIcon
} from '../components/Icons';

const SORTS = [
  { value: 'new', label: 'ใหม่ล่าสุด' },
  { value: 'title', label: 'ชื่อ ก-ฮ' },
  { value: 'available', label: 'พร้อมให้ยืมก่อน' }
];

function greetingByTime() {
  const h = new Date().getHours();
  if (h < 12) return 'สวัสดีตอนเช้า';
  if (h < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const due = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

export default function Home() {
  const { user } = getSession();
  const { ids: favIds } = useFavorites();
  const [books, setBooks] = useState([]);
  const [allBooks, setAllBooks] = useState([]);
  const [types, setTypes] = useState([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [sort, setSort] = useState('new');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyFav, setOnlyFav] = useState(false);
  const [dueAlert, setDueAlert] = useState(null);

  useEffect(() => {
    api.getBookTypes().then(setTypes).catch(() => {});
    api.getBooks().then(setAllBooks).catch(() => {});
  }, []);

  // แจ้งเตือนในแอป: มีหนังสือใกล้ครบกำหนด/เกินกำหนดคืนหรือไม่
  useEffect(() => {
    if (!user) return;
    api.getMyBorrows().then(rows => {
      const active = rows.filter(r => r.status === 'borrowing');
      const overdue = active.filter(r => daysUntil(r.due_date) < 0);
      const soon = active.filter(r => { const d = daysUntil(r.due_date); return d >= 0 && d <= 3; });
      if (overdue.length) setDueAlert({ kind: 'danger', title: `มีหนังสือเกินกำหนดคืน ${overdue.length} เล่ม`, text: `"${overdue[0].title}" เลยกำหนดคืนแล้ว กรุณาส่งคืนโดยเร็ว` });
      else if (soon.length) {
        const d = daysUntil(soon[0].due_date);
        setDueAlert({ kind: 'warn', title: `ใกล้ครบกำหนดคืน ${soon.length} เล่ม`, text: `"${soon[0].title}" ${d === 0 ? 'ครบกำหนดคืนวันนี้' : `อีก ${d} วันครบกำหนดคืน`}` });
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (type) params.type = type;
    api.getBooks(params).then(setBooks).finally(() => setLoading(false));
  }, [search, type]);

  function countForType(typeId) {
    return allBooks.filter(b => b.book_type_id === typeId).length;
  }

  const visibleBooks = useMemo(() => {
    let list = [...books];
    if (onlyAvailable) list = list.filter(b => b.available_copies > 0);
    if (onlyFav) list = list.filter(b => favIds.includes(b.id));
    if (sort === 'title') list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'th'));
    if (sort === 'available') list.sort((a, b) => (b.available_copies > 0) - (a.available_copies > 0));
    return list;
  }, [books, onlyAvailable, onlyFav, favIds, sort]);

  const favBooks = useMemo(() => allBooks.filter(b => favIds.includes(b.id)), [allBooks, favIds]);
  // ปกบน hero เลือกจากไฟล์ในระบบก่อน (โหลดได้แน่นอน) ไม่พึ่งลิงก์ภายนอก
  const showcaseBooks = [
    ...allBooks.filter(b => b.cover_image && b.cover_image.startsWith('/')),
    ...allBooks.filter(b => b.cover_image && /^https?:/.test(b.cover_image))
  ].slice(0, 3);
  const latestBooks = allBooks.slice(0, 8);
  const isFiltering = !!(search || type || onlyAvailable || onlyFav);

  const selectedType = types.find(t => String(t.id) === type);
  const selectedLabel = selectedType ? selectedType.type_name : 'ทั้งหมด';
  const selectedSub = selectedType
    ? `${countForType(selectedType.id)} เล่ม · ยืม ${selectedType.borrow_days} วัน`
    : `${allBooks.length} เล่ม`;
  const selectedArt = selectedType ? gradientFor(selectedType.type_name) : 'linear-gradient(160deg, #8a94a6, #4d5568)';

  return (
    <div>
      <div className="greeting">{greetingByTime()}{user?.full_name ? `, ${user.full_name}` : ''}</div>
      <div className="greeting-sub">มาหาหนังสือดีๆ เล่มต่อไปกันเถอะ</div>

      {dueAlert && (
        <Link to="/my-book" className={`notice-banner ${dueAlert.kind === 'danger' ? 'danger' : ''}`}>
          <AlertIcon size={20} />
          <span className="grow"><b>{dueAlert.title}</b><span>{dueAlert.text}</span></span>
          <ChevronRightIcon size={18} />
        </Link>
      )}

      <div className="home-hero">
        <div className="home-hero-text">
          <div className="home-hero-title">ยืมหนังสือง่ายๆ<br />ส่งถึงบ้านคุณ</div>
          <p className="home-hero-sub">เลือกเล่มที่ชอบ ชำระเงินออนไลน์ แล้วรอรับพัสดุได้เลย</p>
          <div className="home-hero-stats">
            <div className="home-hero-stat"><b>{allBooks.length}</b> เล่มในระบบ</div>
            <div className="home-hero-stat"><b>{types.length}</b> หมวดหมู่</div>
          </div>
        </div>
        {showcaseBooks.length > 0 && (
          <div className="home-hero-covers" aria-hidden="true">
            {showcaseBooks.map((b, i) => (
              <img
                key={b.id} src={b.cover_image} alt="" className={`home-hero-cover c${i}`}
                referrerPolicy="no-referrer"
                onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
                onLoad={e => { if (e.currentTarget.naturalWidth <= 1) e.currentTarget.style.visibility = 'hidden'; }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="search-bar">
        <span className="icon-left"><SearchIcon size={17} /></span>
        <input placeholder="ค้นหาชื่อหนังสือ, ผู้แต่ง, แนวหนังสือ" value={search} onChange={e => setSearch(e.target.value)} aria-label="ค้นหาหนังสือ" />
      </div>

      <button className="category-trigger" onClick={() => setCategoryModalOpen(true)}>
        <span className="category-trigger-art" style={{ background: selectedArt }}>
          <BookStackIcon size={20} />
        </span>
        <span className="category-trigger-text">
          <span className="category-trigger-label">หมวดหมู่: {selectedLabel}</span>
          <span className="category-trigger-sub">{selectedSub}</span>
        </span>
        <span className="category-trigger-chevron"><ChevronDownIcon size={18} /></span>
      </button>

      <CategoryPickerModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        types={types}
        allCount={allBooks.length}
        countForType={countForType}
        value={type}
        onSelect={setType}
      />

      {!isFiltering && favBooks.length > 0 && (
        <>
          <SectionTitle
            icon={<HeartIcon size={16} />}
            title="รายการโปรดของฉัน"
            sub="หนังสือที่คุณกดหัวใจไว้"
            right={<span className="section-header-count">{favBooks.length} เล่ม</span>}
          />
          <div className="book-scroll">
            {favBooks.map(b => <BookCard key={b.id} book={b} showAvailability={false} />)}
          </div>
        </>
      )}

      {!isFiltering && latestBooks.length > 0 && (
        <>
          <SectionTitle
            icon={<SparkleIcon size={16} />}
            title="เพิ่มเข้ามาใหม่ล่าสุด"
            sub="หนังสือที่เพิ่งเข้าร้าน"
            right={<span className="section-header-count">{latestBooks.length} เล่ม</span>}
          />
          <div className="book-scroll">
            {latestBooks.map(b => <BookCard key={b.id} book={b} showAvailability={false} />)}
          </div>
        </>
      )}

      <SectionTitle
        icon={<GridIcon size={16} />}
        title={isFiltering ? 'ผลการค้นหา' : 'หนังสือทั้งหมด'}
        sub={isFiltering ? `พบ ${visibleBooks.length} เล่มที่ตรงกับเงื่อนไข` : 'เลือกดูรายละเอียดก่อนยืมได้เลย'}
        right={!isFiltering && <span className="section-header-count">{books.length} เล่ม</span>}
      />

      <div className="filter-bar">
        <div className="chip-row">
          <button className={`chip${onlyAvailable ? ' active' : ''}`} onClick={() => setOnlyAvailable(v => !v)}>
            พร้อมให้ยืม
          </button>
          <button className={`chip${onlyFav ? ' active' : ''}`} onClick={() => setOnlyFav(v => !v)}>
            <HeartIcon size={14} /> รายการโปรด
          </button>
          {isFiltering && (
            <button className="chip" onClick={() => { setSearch(''); setType(''); setOnlyAvailable(false); setOnlyFav(false); }}>
              ล้างตัวกรอง
            </button>
          )}
        </div>
        <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)} aria-label="เรียงลำดับ">
          {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? <BookGridSkeleton /> : (
        <div className="book-grid">
          {visibleBooks.map(b => <BookCard key={b.id} book={b} />)}
          {visibleBooks.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-icon"><SearchIcon size={24} /></div>
              <p style={{ margin: '0 0 2px', fontWeight: 600 }}>ไม่พบหนังสือที่ตรงกับเงื่อนไข</p>
              <p className="muted" style={{ margin: 0 }}>ลองเปลี่ยนคำค้นหา หมวดหมู่ หรือล้างตัวกรองดูนะ</p>
            </div>
          )}
        </div>
      )}

      <SectionTitle icon={<UserIcon size={16} />} title="เมนูลัด" sub="ทางลัดไปหน้าที่ใช้บ่อย" />
      <div className="quick-list">
        <Link to="/history" className="quick-list-item">
          <span className="quick-list-icon"><HistoryIcon size={18} /></span>
          <span className="grow">
            <div className="label">ประวัติการยืม</div>
            <div className="sub">ดูรายการยืม-คืนหนังสือทั้งหมด</div>
          </span>
          <ChevronRightIcon size={18} />
        </Link>
        <Link to="/profile" className="quick-list-item">
          <span className="quick-list-icon"><UserIcon size={18} /></span>
          <span className="grow">
            <div className="label">ข้อมูลส่วนตัว</div>
            <div className="sub">จัดการโปรไฟล์และบัญชีของคุณ</div>
          </span>
          <ChevronRightIcon size={18} />
        </Link>
      </div>
    </div>
  );
}
