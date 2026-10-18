import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import BookCover from '../components/BookCover';
import { ChevronLeftIcon, TruckIcon } from '../components/Icons';

export default function Borrow() {
  const { id } = useParams(); // book id
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [shippingId, setShippingId] = useState('');
  const [me, setMe] = useState(null);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getBook(id).then(setBook);
    api.getShippingCompanies().then(list => {
      setCompanies(list);
      if (list.length) setShippingId(list[0].id);
    });
    api.getMe().then(setMe);
  }, [id]);

  useEffect(() => {
    if (!shippingId) return;
    api.getQuote(id, shippingId).then(setQuote).catch(e => setError(e.message));
  }, [shippingId, id]);

  async function handleGoToPayment() {
    if (!me?.address) {
      setError('กรุณาตั้งค่าที่อยู่สำหรับจัดส่งหนังสือในหน้าโปรไฟล์ก่อนยืม');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const result = await api.createBorrow({
        book_id: Number(id),
        shipping_company_id: Number(shippingId),
        shipping_address: me.address
      });
      navigate(`/borrow/${result.id}/payment`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!book || !me) return <p className="muted">กำลังโหลด...</p>;

  return (
    <div>
      <div className="book-detail-header">
        <Link to={`/books/${id}`} className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">ยืนยันการยืม</span>
      </div>

      <div className="card summary-card">
        <BookCover book={book} />
        <div>
          <h3 style={{ margin: '0 0 3px', fontSize: 15 }}>{book.title}</h3>
          <p className="muted" style={{ margin: 0 }}>{book.type_name} · ยืมได้สูงสุด {book.borrow_days} วัน</p>
        </div>
      </div>

      <label>ที่อยู่สำหรับจัดส่งหนังสือ</label>
      {me.address ? (
        <div className="card" style={{ padding: 14 }}>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.7 }}>{me.address}</p>
          <Link to="/menu/edit-profile" className="btn-link" style={{ display: 'inline-block', marginTop: 8 }}>
            แก้ไขที่อยู่
          </Link>
        </div>
      ) : (
        <div className="warning-box">
          <span>
            คุณยังไม่มีที่อยู่ในโปรไฟล์ กรุณา
            <Link to="/menu/edit-profile" className="btn-link"> เพิ่มที่อยู่สำหรับจัดส่ง </Link>
            ก่อนยืมหนังสือ
          </span>
        </div>
      )}
      <p className="muted" style={{ marginTop: 4 }}>
        ระบบจะใช้ที่อยู่จากโปรไฟล์ของคุณจัดส่งหนังสืออัตโนมัติทุกครั้งที่ยืม
      </p>

      <label><TruckIcon size={15} style={{ verticalAlign: -3, marginRight: 4 }} />จัดส่งโดย</label>
      {companies.length > 1 ? (
        // เผื่อกรณีมีบริษัทขนส่งเปิดใช้งานมากกว่า 1 บริษัท (ปกติระบบจะให้ใช้ได้ทีละบริษัทเท่านั้น)
        <select value={shippingId} onChange={e => setShippingId(e.target.value)}>
          {companies.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} (ส่งถึง ~{c.delivery_days} วัน, เริ่มต้น {c.base_fee} บาท)
            </option>
          ))}
        </select>
      ) : companies[0] ? (
        <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="quick-list-icon"><TruckIcon size={18} /></span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{companies[0].name}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              ระยะเวลาจัดส่งโดยประมาณ {companies[0].delivery_days} วัน · ค่าจัดส่งเริ่มต้น {companies[0].base_fee} บาท
            </div>
          </div>
        </div>
      ) : (
        <p className="muted">ยังไม่มีบริษัทขนส่งที่เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ</p>
      )}

      {quote && (
        <div className="quote-box">
          <p>ค่าจัดส่ง: <b>{quote.shipping_fee} บาท</b></p>
          <p>ค่ามัดจำหนังสือ (คืนเต็มจำนวนเมื่อคืนหนังสือสภาพดี): <b>{quote.deposit_amount} บาท</b></p>
          <p>วันที่เริ่มยืม: {quote.borrow_date}</p>
          <p>กำหนดคืนภายในวันที่: <b>{quote.due_date}</b> (รวมเวลาจัดส่งไป-กลับ {quote.delivery_days * 2} วัน)</p>
          <hr />
          <p>ยอดชำระตอนนี้ (ค่าส่ง + มัดจำ): <b>{quote.total_pay} บาท</b></p>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      <button className="btn-primary" style={{ marginTop: 16 }} onClick={handleGoToPayment} disabled={!quote || !me.address || submitting}>
        {submitting ? 'กำลังสร้างรายการ...' : 'ถัดไป: ชำระเงิน →'}
      </button>
    </div>
  );
}
