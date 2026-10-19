import { useCallback, useEffect, useState } from 'react';

// จัดการธีมสว่าง/มืด — จำค่าที่ผู้ใช้เลือกไว้ใน localStorage และตามค่าเริ่มต้นของระบบถ้ายังไม่เคยเลือก
function readTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export default function useTheme() {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch (e) { /* ignore */ }
      return next;
    });
  }, []);

  return { theme, toggle };
}
