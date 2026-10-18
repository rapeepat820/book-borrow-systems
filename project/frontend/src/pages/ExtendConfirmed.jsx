import { useLocation, useParams, Link } from 'react-router-dom';
import { CheckCircleIcon } from '../components/Icons';

export default function ExtendConfirmed() {
  const { id } = useParams();
  const { state } = useLocation();

  return (
    <div>
      <div className="success-icon-wrap">
        <div className="success-icon"><CheckCircleIcon size={38} /></div>
      </div>
      <div className="success-title">ส่งสลิปชำระค่าธรรมเนียมแล้ว</div>
      <div className="success-sub">รอเจ้าหน้าที่ตรวจสอบสลิป เมื่อยืนยันแล้วกำหนดคืนของคุณจะถูกต่ออายุให้ทันที</div>

      <div className="card">
        <div className="summary-row"><span className="label">กำหนดคืนเดิม</span><span className="value">{state?.dueDate?.slice(0, 10) || '-'}</span></div>
        <div className="summary-row"><span className="label">ระยะเวลาที่ขอต่อ</span><span className="value">+{state?.days || '-'} วัน</span></div>
        {state?.fee != null && (
          <div className="summary-row"><span className="label">ค่าธรรมเนียมที่ชำระ</span><span className="value">{state.fee} บาท</span></div>
        )}
      </div>

      <Link to="/my-book" className="btn-primary">ปิด</Link>
    </div>
  );
}
