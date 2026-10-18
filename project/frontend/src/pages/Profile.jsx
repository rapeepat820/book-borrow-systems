import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getSession } from '../api';
import { ChevronRightIcon, HistoryIcon, EditIcon, MenuIcon } from '../components/Icons';

export default function Profile() {
  const { user } = getSession();
  const [borrowing, setBorrowing] = useState(0);
  const [returned, setReturned] = useState(0);

  useEffect(() => {
    api.getMyBorrows().then(rows => {
      setBorrowing(rows.filter(r => ['pending_shipment', 'borrowing', 'return_requested'].includes(r.status)).length);
      setReturned(rows.filter(r => r.status === 'returned').length);
    });
  }, []);

  const initial = (user?.full_name || '?').trim().charAt(0).toUpperCase();

  return (
    <div>
      <div className="profile-header">
        <div className="avatar-circle">{initial}</div>
        <div className="profile-name">{user?.full_name}</div>
        <div className="muted">{user?.email}</div>
      </div>

      <div className="stat-row">
        <div className="stat-pill blue">
          <div className="num">{borrowing}</div>
          <div className="cap">เล่มที่ยืมอยู่</div>
        </div>
        <div className="stat-pill light">
          <div className="num">{returned}</div>
          <div className="cap">เล่มที่คืนแล้ว</div>
        </div>
      </div>

      <div className="section-title">บัญชีของฉัน</div>
      <div className="quick-list">
        <Link to="/history" className="quick-list-item">
          <span className="quick-list-icon"><HistoryIcon size={18} /></span>
          <span className="grow">
            <div className="label">ประวัติการยืมหนังสือ</div>
            <div className="sub">ดูรายการยืม-คืนทั้งหมด</div>
          </span>
          <ChevronRightIcon size={18} />
        </Link>
        <Link to="/menu/edit-profile" className="quick-list-item">
          <span className="quick-list-icon"><EditIcon size={18} /></span>
          <span className="grow">
            <div className="label">แก้ไขโปรไฟล์</div>
            <div className="sub">ชื่อ เบอร์โทร และที่อยู่จัดส่ง</div>
          </span>
          <ChevronRightIcon size={18} />
        </Link>
        <Link to="/menu" className="quick-list-item">
          <span className="quick-list-icon"><MenuIcon size={18} /></span>
          <span className="grow">
            <div className="label">เมนูตั้งค่าทั้งหมด</div>
            <div className="sub">รหัสผ่าน ภาษา และข้อกำหนด</div>
          </span>
          <ChevronRightIcon size={18} />
        </Link>
      </div>
    </div>
  );
}
