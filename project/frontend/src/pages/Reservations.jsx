import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import BookCover from '../components/BookCover';
import { ChevronLeftIcon } from '../components/Icons';

const STATUS = {
  ready: { text: 'พร้อมให้ยืมแล้ว', cls: 'pill-green' },
  waiting: { text: 'รอคิว', cls: 'pill-amber' },
  fulfilled: { text: 'ยืมแล้ว', cls: 'pill-blue' },
  expired: { text: 'หมดเวลา', cls: 'pill-gray' },
  cancelled: { text: 'ยกเลิก', cls: 'pill-gray' }
};

export default function Reservations() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  function load() { api.getMyReservations().then(setData).catch(e => setError(e.message)); }
  useEffect(load, []);

  async function handleCancel(id) {
    if (!confirm('ยกเลิกการจองคิวเล่มนี้?')) return;
    try { await api.cancelReservation(id); load(); } catch (e) { setError(e.message); }
  }

  const fmt = v => String(v).replace('T', ' ').slice(0, 16);

  return (
    <div>
      <div className="book-detail-header">
        <Link to="/menu" className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">การจองคิวหนังสือ</span>
      </div>
      <p className="muted">เมื่อหนังสือที่จองมีเล่มว่าง เราจะอีเมลแจ้งและกันเล่มไว้ให้คุณ {data?.hold_hours || 48} ชั่วโมง ถ้าไม่ยืมภายในเวลานี้ สิทธิ์จะส่งต่อให้คนถัดไป</p>
      {error && <p className="error-text">{error}</p>}
      {!data ? <p className="muted">กำลังโหลด...</p> : data.items.length === 0 ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>คุณยังไม่มีการจองคิว หนังสือที่ถูกยืมหมดจะมีปุ่ม "จองคิว" ที่หน้าหนังสือ</p></div>
      ) : (
        <div className="record-list">
          {data.items.map(r => (
            <div key={r.id} className="card summary-card" style={{ alignItems: 'center' }}>
              <BookCover book={r} />
              <div style={{ flex: 1 }}>
                <Link to={`/books/${r.book_id}`} style={{ textDecoration: 'none', color: 'inherit' }}><h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{r.title}</h3></Link>
                <span className={`pill ${STATUS[r.status].cls}`}>{STATUS[r.status].text}</span>
                {r.status === 'waiting' && <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>คิวที่ {r.position}</p>}
                {r.status === 'ready' && (
                  <p style={{ margin: '6px 0 0', fontSize: 13 }}>กันเล่มไว้ให้ถึง <b>{fmt(r.expires_at)}</b> — <Link to={`/books/${r.book_id}`} className="btn-link">ไปยืมเลย</Link></p>
                )}
              </div>
              {['waiting', 'ready'].includes(r.status) && <button className="btn-link danger" onClick={() => handleCancel(r.id)}>ยกเลิก</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
