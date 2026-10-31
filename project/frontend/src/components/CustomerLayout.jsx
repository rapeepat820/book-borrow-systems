import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { getCart } from '../cart';
import Logo from './Logo';
import BottomNav from './BottomNav';
import ThemeToggle from './ThemeToggle';
import { MenuIcon, CartIcon } from './Icons';

const TAB_PATHS = ['/', '/my-book', '/history', '/profile'];
// หน้าที่ใช้พื้นที่กว้างบนจอคอมพิวเตอร์ (หน้าอื่นเป็นฟอร์มจึงจัดให้แคบอ่านง่าย)
const WIDE_PATHS = ['/', '/my-book', '/history'];

const NAV_LINKS = [
  { to: '/', label: 'หน้าแรก', end: true },
  { to: '/my-book', label: 'หนังสือของฉัน' },
  { to: '/history', label: 'ประวัติ' },
  { to: '/profile', label: 'โปรไฟล์' }
];

export default function CustomerLayout() {
  const { pathname } = useLocation();
  const [cartCount, setCartCount] = useState(getCart().length);
  useEffect(() => {
    const update = () => setCartCount(getCart().length);
    window.addEventListener('cart-changed', update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('cart-changed', update); window.removeEventListener('storage', update); };
  }, []);
  const showBottomNav = TAB_PATHS.includes(pathname);
  const wide = WIDE_PATHS.includes(pathname) || pathname.startsWith('/books/');

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" style={{ textDecoration: 'none' }}><Logo size={34} textSize={15} /></Link>
          <nav className="topbar-nav" aria-label="เมนูหลัก">
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
            ))}
          </nav>
          <div className="topbar-actions">
            <ThemeToggle />
            <Link to="/cart" className="topbar-icon-btn" aria-label="ตะกร้าหนังสือ" style={{ position: 'relative' }}>
              <CartIcon size={18} />
              {cartCount > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px', background: 'var(--primary)', color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cartCount}</span>}
            </Link>
            <Link to="/menu" className="topbar-icon-btn" aria-label="เมนู"><MenuIcon size={18} /></Link>
          </div>
        </div>
      </header>
      <main className={`app-content${wide ? ' wide' : ''}`} style={{ paddingBottom: showBottomNav ? undefined : 40 }}>
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
