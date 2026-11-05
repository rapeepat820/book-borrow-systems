import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import BookCover from '../components/BookCover';
import { ChevronLeftIcon, AlertIcon } from '../components/Icons';

const addDays = (iso, n) => {
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function RequestExtend() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getBorrowRecord(id).then(setRecord).catch(e => setError(e.message));
    api.getExtendQuote(id).then(setQuote).catch(e => setError(e.message));
  }, [id]);

  async function handleConfirm() {
    setSubmitting(true);
    setError('');
    try {
      const result = await api.requestExtend(id);
      navigate(`/extend/${id}/payment`, { state: { days: result.extra_days, dueDate: record.due_date, fee: result.extend_fee } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!record || !quote) return error ? <p className="error-text">{error}</p> : <p className="muted">กำลังโหลด...</p>;

  const oldDue = String(record.due_date).slice(0, 10);
  return (
    <div>
      <div className="book-detail-header">
        <Link to="/my-book" className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">ต่ออายุการยืม</span>
      </div>

      <div className="card summary-card">
        <BookCover book={record} />
        <div>
          <h3 style={{ margin: '0 0 3px', fontSize: 15 }}>{record.title}</h3>
          <p className="muted" style={{ margin: 0 }}>โดย {record.author}</p>
        </div>
      </div>

      <div className="card">
        <div className="summary-row"><span className="label">กำหนดคืนเดิม</span><span className="value">{oldDue}</span></div>
        <div className="summary-row"><span className="label">ต่ออายุเพิ่ม</span><span className="value">+{quote.extra_days} วัน</span></div>
        <div className="summary-row"><span className="label">กำหนดคืนใหม่</span><span className="value"><b>{addDays(oldDue, quote.extra_days)}</b></span></div>
        <div className="summary-row"><span className="label">ค่าธรรมเนียมต่ออายุ</span><span className="value"><b>{Number(quote.extend_fee).toLocaleString()} บาท</b></span></div>
        <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>ค่าธรรมเนียมเท่ากับค่ามัดจำของหนังสือเล่มนี้ ต่ออายุได้ครั้งละเท่าระยะเวลายืมปกติของหนังสือประเภทนี้</p>
      </div>

      <div className="warning-box">
        <AlertIcon size={17} />
        <span>ต้องชำระค่าธรรมเนียมและรอเจ้าหน้าที่ตรวจสอบสลิปก่อน จึงจะมีผลกับกำหนดคืนจริง ค่าธรรมเนียมนี้ไม่คืนให้</span>
      </div>

      {error && <p className="error-text">{error}</p>}
      <button className="btn-primary" onClick={handleConfirm} disabled={submitting}>
        {submitting ? 'กำลังส่งคำขอ...' : 'ถัดไป: ชำระค่าธรรมเนียม →'}
      </button>
      <Link to="/my-book" className="btn-outline center" style={{ marginTop: 10, display: 'block', textDecoration: 'none' }}>ยกเลิก</Link>
    </div>
  );
}
