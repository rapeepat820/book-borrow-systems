import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import ThemeToggle from '../../components/ThemeToggle';
import { getSession, clearSession } from '../../api';
import { HomeIcon, BookStackIcon, UsersIcon, RepeatIcon, LogoutIcon } from '../../components/Icons';

const NAV = [
  { to: '/admin', label: 'Dashboard', Icon: HomeIcon, end: true },
  { to: '/admin/books', label: 'คลังหนังสือ', Icon: BookStackIcon },
  { to: '/admin/members', label: 'สมาชิก', Icon: UsersIcon },
  { to: '/admin/borrow-records', label: 'การยืม-คืน', Icon: RepeatIcon }
];

export default function AdminLayout() {
  const { user } = getSession();
  const navigate = useNavigate();
  const initial = (user?.full_name || 'A').trim().charAt(0).toUpperCase();

  function handleLogout() {
    clearSession();
    navigate('/admin/login');
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Logo size={34} textSize={14} />
        <div className="admin-nav-label">ระบบแอดมิน</div>
        <nav className="admin-nav">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-user-chip">
            <div className="avatar-circle">{initial}</div>
            <div>
              <div className="name">{user?.full_name || 'Admin User'}</div>
              <div className="role">แอดมินร้านหนังสือ</div>
            </div>
          </div>
          <div className="admin-footer-actions">
            <ThemeToggle />
            <button className="admin-logout" onClick={handleLogout}>
              <LogoutIcon size={16} /> <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
