import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import BookCover from '../components/BookCover';
import ShippingTracker from '../components/ShippingTracker';
import { ChevronLeftIcon, TruckIcon } from '../components/Icons';

export default function TrackingDetail() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);

  useEffect(() => { api.getBorrowRecord(id).then(setRecord); }, [id]);

  if (!record) return <p className="muted">กำลังโหลด...</p>;

  return (
    <div>
      <div className="book-detail-header">
        <Link to="/my-book" className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">ติดตามพัสดุ</span>
      </div>

      <div className="card summary-card">
        <BookCover book={record} />
        <div>
          <h3 style={{ margin: '0 0 3px', fontSize: 15 }}>{record.title}</h3>
          <p className="muted" style={{ margin: 0 }}>{record.shipping_company_name}</p>
        </div>
      </div>

      {record.tracking_no ? (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>เลขพัสดุ (Tracking No.)</div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{record.tracking_no}</div>
          </div>
          {record.tracking_url && (
            <a href={record.tracking_url} target="_blank" rel="noreferrer" className="btn-secondary auto">
              <TruckIcon size={15} /> เช็คกับขนส่ง
            </a>
          )}
        </div>
      ) : (
        <p className="pill pill-gray" style={{ display: 'block', padding: 12, marginBottom: 14 }}>
          ยังไม่มีเลขพัสดุ — ร้านกำลังเตรียมจัดส่งให้คุณ
        </p>
      )}

      <div className="card">
        <h3 style={{ fontSize: 14.5, marginBottom: 14 }}>สถานะการจัดส่ง</h3>
        <ShippingTracker shippingStatus={record.shipping_status} />
      </div>

      <p className="muted" style={{ fontSize: 12.5 }}>
        หมายเหตุ: สถานะนี้อัปเดตโดยเจ้าหน้าที่ร้าน สำหรับสถานะแบบเรียลไทม์จากบริษัทขนส่งโดยตรง กดปุ่ม "เช็คกับขนส่ง" ด้านบนแล้ววางเลขพัสดุที่หน้าเว็บของขนส่งได้เลย
      </p>
    </div>
  );
}
