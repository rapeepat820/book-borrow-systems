import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import BookCover from '../components/BookCover';
import { ChevronLeftIcon, AlertIcon } from '../components/Icons';

const OPTIONS = [3, 7, 14];
const EXTEND_FEE_PER_DAY = 5; // บาทต่อวัน (ต้องตรงกับ backend/utils/calcBorrow.js) — ใช้แสดงยอดประมาณก่อนกดยืนยัน

export default function RequestExtend() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [days, setDays] = useState(7);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { api.getBorrowRecord(id).then(setRecord); }, [id]);

  async function handleConfirm() {
    setSubmitting(true);
    setError('');
    try {
      const result = await api.requestExtend(id, days);
      navigate(`/extend/${id}/payment`, { state: { days, dueDate: record.due_date, fee: result.extend_fee } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!record) return <p className="muted">กำลังโหลด...</p>;

  return (
    <div>
      <div className="book-detail-header">
        <Link to="/my-book" className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">ยืนยัน</span>
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 2 }}>ขอยืดเวลาการยืม</h2>
      <p className="muted" style={{ marginBottom: 16 }}>เลือกจำนวนวันที่ต้องการต่ออายุการยืมหนังสือเล่มนี้ (มีค่าธรรมเนียมต่ออายุตามจำนวนวัน)</p>

      <div className="card summary-card">
        <BookCover book={record} />
        <div>
          <h3 style={{ margin: '0 0 3px', fontSize: 15 }}>{record.title}</h3>
          <p className="muted" style={{ margin: 0 }}>โดย {record.author}</p>
        </div>
      </div>

      <div className="card">
        <div className="summary-row"><span className="label">กำหนดคืนเดิม</span><span className="value">{record.due_date?.slice(0, 10)}</span></div>
        <div className="summary-row">
          <span className="label">ระยะเวลาที่ต้องการต่อ</span>
          <span className="value">
            <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: 'auto', padding: '4px 10px' }}>
              {OPTIONS.map(d => <option key={d} value={d}>+{d} วัน</option>)}
            </select>
          </span>
        </div>
      </div>

      <div className="quote-box">
        <p>ค่าธรรมเนียมต่ออายุ ({days} วัน x {EXTEND_FEE_PER_DAY} บาท/วัน): <b>{days * EXTEND_FEE_PER_DAY} บาท</b></p>
      </div>

      <div className="warning-box">
        <AlertIcon size={17} />
        <span>หมายเหตุ: ต้องชำระค่าธรรมเนียมต่ออายุและรอเจ้าหน้าที่ตรวจสอบสลิปก่อน จึงจะมีผลกับกำหนดคืนจริง</span>
      </div>

      {error && <p className="error-text">{error}</p>}
      <button className="btn-primary" onClick={handleConfirm} disabled={submitting}>
        {submitting ? 'กำลังส่งคำขอ...' : 'ถัดไป: ชำระค่าธรรมเนียม →'}
      </button>
      <Link to="/my-book" className="btn-outline center" style={{ marginTop: 10, display: 'block', textDecoration: 'none' }}>ยกเลิก</Link>
    </div>
  );
}
