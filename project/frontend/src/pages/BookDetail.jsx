import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, getSession } from '../api';
import BookCover from '../components/BookCover';
import BookCard from '../components/BookCard';
import FavButton from '../components/FavButton';
import { DetailSkeleton } from '../components/Skeleton';
import { ChevronLeftIcon, StarIcon } from '../components/Icons';

export default function BookDetail() {
  const { id } = useParams();
  const [book, setBook] = useState(null);
  const [related, setRelated] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const { user } = getSession();

  useEffect(() => {
    setBook(null); setExpanded(false); setRelated([]);
    api.getBook(id).then(b => {
      setBook(b);
      // หนังสือประเภทเดียวกัน (ไม่รวมเล่มนี้) ให้เลือกเล่มต่อไปได้ทันที
      api.getBooks({ type: b.book_type_id })
        .then(rows => setRelated(rows.filter(r => r.id !== b.id).slice(0, 8)))
        .catch(() => {});
    });
    window.scrollTo({ top: 0 });
  }, [id]);

  if (!book) return <DetailSkeleton />;

  const longDesc = (book.description || '').length > 280;

  return (
    <div>
      <div className="book-detail-header">
        <Link to="/" className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">{book.title}</span>
        <FavButton bookId={book.id} className="static" />
      </div>

      <div className="book-detail-layout">
      <div className="book-detail-media">
        <BookCover book={book} size="large" />
      </div>
      <div>
      {book.author && <p className="muted book-detail-byline">โดย {book.author}</p>}

      <div className="badge-row">
        <span className="pill pill-blue"><StarIcon size={13} /> {book.type_name}</span>
        <span className="pill pill-gray">ยืมได้ {book.borrow_days} วัน</span>
        <span className={`pill ${book.available_copies > 0 ? 'pill-green' : 'pill-red'}`}>
          {book.available_copies > 0 ? `พร้อมให้ยืม (เหลือ ${book.available_copies})` : 'ยืมหมดแล้ว'}
        </span>
        <span className="pill pill-amber">มัดจำ {book.type_deposit} บาท</span>
      </div>

      <div className="section-title">ข้อมูลหนังสือ</div>
      <div className="card" style={{ padding: 6 }}>
        {[
          ['ชื่อหนังสือ', book.title],
          ['ผู้แต่ง', book.author],
          ['สำนักพิมพ์', book.publisher],
          ['ปีที่พิมพ์', book.publish_year ? `${book.publish_year} (ค.ศ.)` : null, true],
          ['ฉบับที่', book.edition, true],
          ['เล่มที่', book.volume, true],
          ['ตีพิมพ์ครั้งที่', book.print_no]
        ].filter(([, v, always]) => always || (v !== null && v !== undefined && String(v).trim() !== '')).map(([label, value]) => (
          <div className="summary-row" key={label}>
            <span className="label">{label}</span>
            <span className="value">{value !== null && value !== undefined && String(value).trim() !== '' ? value : 'ไม่ระบุ'}</span>
          </div>
        ))}
      </div>

      <div className="section-title">เรื่องย่อ</div>
      {book.description ? (
        <>
          <p className={`desc-text${!expanded && longDesc ? ' clamped' : ''}`}>{book.description}</p>
          {longDesc && (
            <button type="button" className="desc-toggle" onClick={() => setExpanded(v => !v)}>
              {expanded ? 'ย่อลง' : 'อ่านเพิ่มเติม'}
            </button>
          )}
        </>
      ) : (
        <p className="desc-text muted">ยังไม่มีเรื่องย่อสำหรับหนังสือเล่มนี้</p>
      )}

      {book.available_copies > 0 ? (
        user ? (
          <Link className="btn-primary" style={{ marginTop: 10 }} to={`/borrow/${book.id}`}>ยืมหนังสือเล่มนี้</Link>
        ) : (
          <Link className="btn-primary" style={{ marginTop: 10 }} to="/login">เข้าสู่ระบบเพื่อยืมหนังสือ</Link>
        )
      ) : (
        <button className="btn-primary" style={{ marginTop: 10 }} disabled>ยืมหมดแล้ว</button>
      )}
      </div>
      </div>

      {related.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 28 }}>หนังสือประเภทเดียวกัน</div>
          <div className="book-scroll">
            {related.map(b => <BookCard key={b.id} book={b} />)}
          </div>
        </>
      )}
    </div>
  );
}
