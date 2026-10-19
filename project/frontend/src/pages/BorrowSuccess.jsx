import { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { api } from '../api';
import BookCover from '../components/BookCover';
import { CheckCircleIcon } from '../components/Icons';

export default function BorrowSuccess() {
  const { id } = useParams();
  const { state } = useLocation();
  const [record, setRecord] = useState(null);

  useEffect(() => { api.getBorrowRecord(id).then(setRecord).catch(() => {}); }, [id]);

  return (
    <div>
      <div className="success-icon-wrap">
        <div className="success-icon"><CheckCircleIcon size={38} /></div>
      </div>
      <div className="success-title">{state?.autoVerified ? 'ชำระเงินสำเร็จ ยืมหนังสือเรียบร้อย!' : 'ส่งสลิปเรียบร้อยแล้ว'}</div>
      <div className="success-sub">
        {state?.autoVerified
          ? 'ระบบตรวจสอบสลิปของคุณแล้ว ขอบคุณที่ยืมหนังสือกับเรา เราจะจัดส่งให้เร็วที่สุด'
          : 'รอเจ้าหน้าที่ตรวจสอบการชำระเงิน เมื่อยืนยันแล้วเราจะจัดส่งหนังสือให้เร็วที่สุด'}
      </div>

      {record && (
        <div className="card summary-card">
          <BookCover book={record} />
          <div>
            <h3 style={{ margin: '0 0 3px', fontSize: 15 }}>{record.title}</h3>
            <p className="muted" style={{ margin: 0 }}>โดย {record.author}</p>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 14.5, margin: 0 }}>ประวัติการยืมหนังสือ</h3>
        </div>
        <div className="pill pill-gray" style={{ display: 'block', textAlign: 'center', marginTop: 12, padding: 14 }}>
          ไม่มีประวัติการยืมหนังสือก่อนหน้านี้
        </div>
      </div>

      <Link to="/" className="btn-primary" style={{ marginTop: 6 }}>กลับสู่หน้าหลัก</Link>
    </div>
  );
}
