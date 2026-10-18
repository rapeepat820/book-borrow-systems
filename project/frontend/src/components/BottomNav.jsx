import { NavLink } from 'react-router-dom';
import { HomeIcon, BookStackIcon, HistoryIcon, UserIcon } from './Icons';

const items = [
  { to: '/', label: 'หน้าแรก', Icon: HomeIcon, end: true },
  { to: '/my-book', label: 'หนังสือของฉัน', Icon: BookStackIcon },
  { to: '/history', label: 'ประวัติ', Icon: HistoryIcon },
  { to: '/profile', label: 'โปรไฟล์', Icon: UserIcon }
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
          <Icon size={21} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
