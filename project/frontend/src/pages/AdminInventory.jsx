import { useState } from 'react';
import AdminBooks from './AdminBooks';
import AdminBookTypes from './AdminBookTypes';
import AdminShipping from './AdminShipping';

const TABS = [
  { key: 'books', label: 'รายการหนังสือ' },
  { key: 'types', label: 'ประเภทหนังสือ' },
  { key: 'shipping', label: 'บริษัทขนส่ง' }
];

export default function AdminInventory() {
  const [tab, setTab] = useState('books');
  return (
    <div>
      <div className="admin-tabs">
        {TABS.map(t => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {tab === 'books' && <AdminBooks />}
      {tab === 'types' && <AdminBookTypes />}
      {tab === 'shipping' && <AdminShipping />}
    </div>
  );
}
