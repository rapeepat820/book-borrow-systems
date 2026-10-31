import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, getSession } from '../api';
import { addToCart, inCart } from '../cart';
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
  const [rs, setRs] = useState(null); // สถานะการจอง/ยืมของผู้ใช้กับหนังสือเล่มนี้
  const [msg, setMsg] = useState('');
  const [inCartNow, setInCartNow] = useState(false);

  function loadStatus() {
    if (user) api.getReservationStatus(id).then(setRs).catch(() => setRs(null));
  }

  useEffect(() => {
    setBook(null); setExpanded(false); setRelated([]);
    api.getBook(id).then(b => {
      setBook(b);
      // หนังสือประเภทเดียวกัน (ไม่รวมเล่มนี้) ให้เลือกเล่มต่อไปได้ทันที
      api.getBooks({ type: b.book_type_id })
        .then(rows => setRelated(rows.filter(r => r.id !== b.id).slice(0, 8)))
        .catch(() => {});
    });
    setMsg(''); setRs(null); setInCartNow(inCart(id));
    loadStatus();
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleReserve() {
    setMsg('');
    try { const r = await api.reserveBook(book.id); setMsg(r.message); loadStatus(); } catch (e) { setMsg(e.message); }
  }
  async function handleCancelReserve() {
    try { await api.cancelReservation(rs.my_reservation.id); setMsg('ยกเลิกการจองแล้ว'); loadStatus(); } catch (e) { setMsg(e.message); }
  }
  function handleAddToCart() {
    const r = addToCart(book.id);
    setMsg(r.ok ? 'เพิ่มลงตะกร้าแล้ว' : r.message);
    setInCartNow(r.ok);
  }

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

      {!user ? (
        <Link className="btn-primary" style={{ marginTop: 10 }} to="/login">
          {book.available_copies > 0 ? 'เข้าสู่ระบบเพื่อยืมหนังสือ' : 'เข้าสู่ระบบเพื่อจองคิว'}
        </Link>
      ) : (() => {
        const mine = rs?.my_reservation;
        const canBorrow = rs ? rs.can_borrow_now : book.available_copies > 0;
        return (
          <div style={{ marginTop: 10 }}>
            {mine?.status === 'ready' && (
              <div className="warning-box" style={{ borderColor: 'var(--success, #22c55e)' }}>
                <span>เล่มนี้พร้อมให้ยืมแล้ว กันไว้ให้คุณถึง <b>{String(mine.expires_at).replace('T', ' ').slice(0, 16)}</b></span>
              </div>
            )}
            {mine?.status === 'waiting' && (
              <div className="warning-box"><span>คุณอยู่ในคิวที่ <b>{mine.position}</b> (มีผู้จองทั้งหมด {rs.queue_length} คน) เมื่อมีเล่มว่างเราจะอีเมลแจ้ง</span></div>
            )}
            {canBorrow ? (
              <div className="btn-row">
                <Link className="btn-primary" to={`/borrow/${book.id}`}>ยืมหนังสือเล่มนี้</Link>
                {!inCartNow
                  ? <button type="button" className="btn-outline" onClick={handleAddToCart}>เพิ่มลงตะกร้า</button>
                  : <Link className="btn-outline" to="/cart">อยู่ในตะกร้า — ไปที่ตะกร้า</Link>}
              </div>
            ) : mine?.status === 'waiting' ? (
              <button type="button" className="btn-outline" onClick={handleCancelReserve}>ยกเลิกการจองคิว</button>
            ) : (
              <>
                <button type="button" className="btn-primary" onClick={handleReserve}>
                  จองคิว{rs?.queue_length ? ` (มีคิวรออยู่ ${rs.queue_length} คน)` : ''}
                </button>
                <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>เล่มนี้ถูกยืมหมดแล้ว จองคิวไว้ได้ เมื่อมีคนคืนเราจะกันเล่มไว้ให้คุณ {rs?.hold_hours || 48} ชั่วโมง</p>
              </>
            )}
            {msg && <p className="muted" style={{ margin: '8px 0 0' }}>{msg}</p>}
          </div>
        );
      })()}
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
