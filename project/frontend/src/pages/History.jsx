import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import BookCover from '../components/BookCover';
import { CardListSkeleton } from '../components/Skeleton';
import { SearchIcon, HistoryIcon } from '../components/Icons';

const STATUS_LABEL = {
  pending_shipment: 'รอจัดส่ง',
  borrowing: 'กำลังยืม',
  return_requested: 'รอตรวจสอบการคืน',
  returned: 'คืนแล้ว',
  overdue: 'เกินกำหนดคืน'
};

const FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'borrowing', label: 'กำลังยืม' },
  { key: 'returned', label: 'คืนแล้ว' }
];

export default function History() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { api.getMyBorrows().then(setRecords).finally(() => setLoading(false)); }, []);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filter === 'borrowing' && !['pending_shipment', 'borrowing', 'return_requested'].includes(r.status)) return false;
      if (filter === 'returned' && r.status !== 'returned') return false;
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [records, filter, search]);

  return (
    <div>
      <div className="book-detail-title" style={{ marginBottom: 4 }}>ประวัติการยืม</div>
      <p className="muted" style={{ marginBottom: 14 }}>ดูประวัติการยืม-คืนหนังสือทั้งหมดของคุณ</p>

      <div className="search-bar">
        <span className="icon-left"><SearchIcon size={17} /></span>
        <input placeholder="ค้นหาชื่อหนังสือ..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="chip-row">
        {FILTERS.map(f => (
          <button key={f.key} className={`chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>

            {loading ? <CardListSkeleton /> : (
        <div className="record-list">
          {filtered.map(r => (
            <Link key={r.id} to={r.status === 'returned' || r.status === 'return_requested' ? '#' : `/my-book`} className="card record-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <BookCover book={r} />
              <div className="record-body">
                <div className="record-header">
                  <h3>{r.title}</h3>
                  <span className={`status-badge status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                </div>
                <p className="muted" style={{ margin: '2px 0' }}>ยืม {r.borrow_date?.slice(0, 10)} · กำหนดคืน {r.due_date?.slice(0, 10)}</p>
                {r.is_overdue && (
                  <p style={{ margin: '2px 0', color: 'var(--danger)', fontSize: 13 }}>เกินกำหนดคืน {r.late_days} วัน · ค่าปรับ {Number(r.late_fee_due).toLocaleString()} บาท</p>
                )}
                {r.status === 'returned' && Number(r.late_fee) > 0 && (
                  <p className="muted" style={{ margin: '2px 0', fontSize: 13 }}>หักค่าปรับเกินกำหนด {Number(r.late_fee).toLocaleString()} บาท</p>
                )}
                {r.status === 'returned' && r.refund_status === 'pending' && (
                  <p className="pill pill-amber" style={{ marginTop: 4, display: 'inline-block' }}>รอโอนมัดจำคืน {Number(r.refund_amount).toLocaleString()} บาท</p>
                )}
                {r.status === 'returned' && r.refund_status === 'refunded' && (
                  <p className="pill pill-green" style={{ marginTop: 4, display: 'inline-block' }}>โอนมัดจำคืนแล้ว {Number(r.refund_amount).toLocaleString()} บาท</p>
                )}
                {r.status === 'returned' && r.refund_status === 'none' && Number(r.late_fee) > 0 && (
                  <p className="muted" style={{ margin: '2px 0', fontSize: 13 }}>ค่าปรับเท่ากับค่ามัดจำ ไม่มียอดโอนคืน</p>
                )}
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="card empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-icon"><HistoryIcon size={24} /></div>
              <p className="muted" style={{ margin: 0 }}>ไม่พบรายการ</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
