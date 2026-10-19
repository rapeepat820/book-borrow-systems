import { Link } from 'react-router-dom';
import { ChevronLeftIcon } from '../components/Icons';

export default function Terms() {
  return (
    <div>
      <div className="book-detail-header">
        <Link to="/menu" className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">ข้อกำหนดและเงื่อนไข</span>
      </div>
      <div className="card" style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text)' }}>
        <p>1. ผู้ยืมต้องคืนหนังสือภายในกำหนดที่ระบบแจ้งไว้ ซึ่งคำนวณจากประเภทหนังสือและระยะเวลาจัดส่งของบริษัทขนส่งที่เลือก</p>
        <p>2. ค่ามัดจำจะถูกเรียกเก็บเพื่อป้องกันความเสียหายหรือการสูญหายของหนังสือ และจะคืนให้เต็มจำนวนเมื่อคืนหนังสือในสภาพเรียบร้อยพร้อมแนบหลักฐานภาพถ่าย</p>
        <p>3. การขอต่ออายุยืมต้องได้รับการอนุมัติจากเจ้าหน้าที่ก่อนจึงจะมีผลกับกำหนดคืนจริง</p>
        <p>4. ค่าจัดส่งคำนวณตามบริษัทขนส่งที่ผู้ยืมเลือก และจะแสดงให้ทราบก่อนยืนยันการยืมทุกครั้ง</p>
        <p>หากมีข้อสงสัยหรือพบปัญหา สามารถ <Link to="/contact" style={{ color: 'var(--primary)', fontWeight: 600 }}>ติดต่อเจ้าหน้าที่</Link> ได้ตลอดเวลา</p>
      </div>
    </div>
  );
}
