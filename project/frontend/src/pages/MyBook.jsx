import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import BookCover from '../components/BookCover';
import { CardListSkeleton } from '../components/Skeleton';
import { TruckIcon, BookStackIcon } from '../components/Icons';

const STATUS_LABEL = {
  pending_shipment: 'รอจัดส่ง',
  borrowing: 'กำลังยืม',
  return_requested: 'รอตรวจสอบการคืน'
};

const SHIPPING_LABEL = {
  preparing: 'กำลังแพ็คสินค้า',
  shipped: 'กำลังจัดส่ง',
  out_for_delivery: 'ขนส่งกำลังนำส่ง',
  delivered: 'จัดส่งสำเร็จ'
};

const PAYMENT_LABEL = {
  pending: 'รอชำระเงิน',
  pending_verification: 'รอตรวจสอบสลิป',
  paid: 'ชำระแล้ว'
};
const PAYMENT_CLASS = {
  pending: 'pill-payment-pending',
  pending_verification: 'pill-amber',
  paid: 'pill-payment-paid'
};

export default function MyBook() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.getMyBorrows()
      .then(rows => setRecords(rows.filter(r => ['pending_shipment', 'borrowing', 'return_requested'].includes(r.status))))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="book-detail-title" style={{ marginBottom: 4 }}>หนังสือที่ยืมอยู่</div>
      <p className="muted" style={{ marginBottom: 16 }}>รายการหนังสือที่คุณกำลังยืมอยู่ในขณะนี้</p>

      {loading ? <CardListSkeleton /> : (
        <div className="record-list">
          {records.map(r => (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', gap: 12 }}>
                <BookCover book={r} />
                <div className="record-body">
                  <div className="record-header">
                    <h3>{r.title}</h3>
                    <span className={`status-badge status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                  </div>
                  <p className="muted" style={{ margin: '2px 0' }}>
                    <TruckIcon size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
                    {r.shipping_company_name} · {SHIPPING_LABEL[r.shipping_status]}
                    {r.tracking_no && ` · ${r.tracking_no}`}
                  </p>
                  <p className="muted" style={{ margin: '2px 0' }}>กำหนดคืน: <b style={{ color: 'var(--text)' }}>{r.due_date?.slice(0, 10)}</b></p>
                  {r.late_days > 0 && ['borrowing', 'return_requested'].includes(r.status) && (
                    <p style={{ margin: '4px 0', color: 'var(--danger)', fontSize: 13 }}>
                      เกินกำหนดคืน {r.late_days} วัน · ค่าปรับ {Number(r.late_fee_due).toLocaleString()} บาท (หักจากมัดจำ){r.status === 'borrowing' ? ' และจะเพิ่มขึ้นทุกวัน' : ''}
                    </p>
                  )}
                  <p className="muted" style={{ margin: '2px 0' }}>
                    การชำระเงิน: <span className={`pill ${PAYMENT_CLASS[r.payment_status]}`} style={{ padding: '2px 9px' }}>
                      {PAYMENT_LABEL[r.payment_status]}
                    </span>
                  </p>
                  {r.extend_status === 'pending' && r.extend_payment_status === 'pending' && (
                    <span className="pill pill-amber" style={{ marginTop: 4 }}>รอชำระค่าธรรมเนียมต่ออายุ (+{r.extend_requested_days} วัน)</span>
                  )}
                  {r.extend_status === 'pending' && r.extend_payment_status === 'pending_verification' && (
                    <span className="pill pill-amber" style={{ marginTop: 4 }}>รอตรวจสอบการชำระค่าธรรมเนียมต่ออายุ (+{r.extend_requested_days} วัน)</span>
                  )}
                </div>
              </div>

              <div className="btn-row">
                {r.payment_status === 'pending' && (
                  <Link to={`/borrow/${r.id}/payment`} className="btn-primary auto" style={{ flex: 1 }}>ชำระเงิน</Link>
                )}
                <Link to={`/track/${r.id}`} className="btn-secondary auto" style={{ flex: 1 }}>ติดตามพัสดุ</Link>
                {r.status !== 'return_requested' && (
                  <>
                    {r.extend_status === 'pending' && r.extend_payment_status === 'pending' ? (
                      <Link to={`/extend/${r.id}/payment`} className="btn-outline" style={{ flex: 1 }}>ชำระค่าธรรมเนียมต่ออายุ</Link>
                    ) : r.extend_status !== 'pending' && (
                      <Link to={`/extend/${r.id}`} className="btn-outline" style={{ flex: 1 }}>ต่ออายุยืม</Link>
                    )}
                    <Link to={`/return/${r.id}`} className="btn-outline" style={{ flex: 1 }}>คืนหนังสือ</Link>
                  </>
                )}
              </div>
              {r.status === 'return_requested' && (
                <p className="pill pill-blue" style={{ display: 'block', marginTop: 12, padding: 10, textAlign: 'center' }}>
                  ส่งหลักฐานการคืนแล้ว รอเจ้าหน้าที่ตรวจสอบและโอนเงินมัดจำคืน
                </p>
              )}
            </div>
          ))}
          {records.length === 0 && (
            <div className="card empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-icon"><BookStackIcon size={24} /></div>
              <p className="muted">คุณยังไม่มีหนังสือที่กำลังยืมอยู่</p>
              <Link to="/" className="btn-primary auto" style={{ marginTop: 8, display: 'inline-flex' }}>ไปหาหนังสือยืม</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
