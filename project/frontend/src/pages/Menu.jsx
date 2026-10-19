import { Link, useNavigate } from 'react-router-dom';
import { clearSession, getSession } from '../api';
import { ChevronLeftIcon, ChevronRightIcon, EditIcon, LogoutIcon, GlobeIcon, FileTextIcon, UserIcon, MessageIcon } from '../components/Icons';

export default function Menu() {
  const { user } = getSession();
  const navigate = useNavigate();

  function handleLogout() {
    clearSession();
    navigate('/login');
  }

  return (
    <div>
      <div className="book-detail-header">
        <Link to="/profile" className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">เมนู</span>
      </div>

      <div className="section-title">บัญชี</div>
      <div className="quick-list">
        <div className="quick-list-item" style={{ cursor: 'default' }}>
          <span className="quick-list-icon"><UserIcon size={18} /></span>
          <span className="grow">
            <div className="label">{user?.full_name}</div>
            <div className="sub">{user?.email}</div>
          </span>
        </div>
      </div>

      <div className="section-title">การตั้งค่า</div>
      <div className="quick-list">
        <Link to="/menu/edit-profile" className="quick-list-item">
          <span className="quick-list-icon"><EditIcon size={18} /></span>
          <span className="grow"><div className="label">แก้ไขโปรไฟล์</div></span>
          <ChevronRightIcon size={18} />
        </Link>
        <Link to="/menu/change-password" className="quick-list-item">
          <span className="quick-list-icon"><LogoutIcon size={18} style={{ transform: 'rotate(180deg)' }} /></span>
          <span className="grow"><div className="label">เปลี่ยนรหัสผ่าน</div></span>
          <ChevronRightIcon size={18} />
        </Link>
        <div className="quick-list-item" style={{ cursor: 'default' }}>
          <span className="quick-list-icon"><GlobeIcon size={18} /></span>
          <span className="grow"><div className="label">ภาษา</div></span>
          <span className="muted">ไทย</span>
        </div>
        <Link to="/contact" className="quick-list-item">
          <span className="quick-list-icon"><MessageIcon size={18} /></span>
          <span className="grow"><div className="label">ติดต่อเจ้าหน้าที่</div></span>
          <ChevronRightIcon size={18} />
        </Link>
        <Link to="/terms" className="quick-list-item">
          <span className="quick-list-icon"><FileTextIcon size={18} /></span>
          <span className="grow"><div className="label">ข้อกำหนดและเงื่อนไข</div></span>
          <ChevronRightIcon size={18} />
        </Link>
        <Link to="/privacy" className="quick-list-item">
          <span className="quick-list-icon"><FileTextIcon size={18} /></span>
          <span className="grow"><div className="label">นโยบายความเป็นส่วนตัว</div></span>
          <ChevronRightIcon size={18} />
        </Link>
      </div>

      <div className="section-title" style={{ opacity: 0 }}>&nbsp;</div>
      <div className="quick-list">
        <button className="quick-list-item danger" style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={handleLogout}>
          <span className="quick-list-icon"><LogoutIcon size={18} /></span>
          <span className="grow"><div className="label">ออกจากระบบ</div></span>
        </button>
      </div>
    </div>
  );
}
