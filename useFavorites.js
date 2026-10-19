import { useCallback, useEffect, useState } from 'react';

// รายการหนังสือที่ถูกใจ — เก็บในเบราว์เซอร์ (localStorage) ซิงก์ข้ามคอมโพเนนต์/แท็บด้วย event
const KEY = 'favorites';
const EVENT = 'favorites-changed';

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

export default function useFavorites() {
  const [ids, setIds] = useState(read);

  useEffect(() => {
    const sync = () => setIds(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggle = useCallback((id) => {
    const current = read();
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const isFav = useCallback((id) => ids.includes(id), [ids]);

  return { ids, isFav, toggle };
}
