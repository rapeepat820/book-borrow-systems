import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getSession } from '../api';
import { AlertIcon } from './Icons';

// แถบเตือนให้ยืนยันตัวตน (แสดงเฉพาะเมื่อผู้ใช้ล็อกอินอยู่และยังไม่ผ่าน)
export default function VerifyBanner() {
  const { user } = getSession();
  const [st, setSt] = useState(null);
  useEffect(() => {
    if (user && user.role !== 'admin') api.getIdentityStatus().then(setSt).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!st || !st.required || st.status === 'verified') return null;
  const text = {
    unverified: 'ยังไม่ได้ยืนยันตัวตน — ต้องยืนยันก่อนจึงจะยืมหนังสือได้',
    pending: 'ส่งข้อมูลยืนยันตัวตนแล้ว กำลังรอแอดมินตรวจสอบ เมื่ออนุมัติแล้วจะยืมได้ทันที',
    rejected: `การยืนยันตัวตนไม่ผ่าน${st.reject_reason ? ` (${st.reject_reason})` : ''} — กรุณาส่งข้อมูลใหม่`
  }[st.status];
  return (
    <div className="warning-box" style={{ marginBottom: 12 }}>
      <AlertIcon size={17} />
      <span>{text}{st.status !== 'pending' && <> <Link to="/verify-identity" className="btn-link">ยืนยันตัวตนตอนนี้</Link></>}</span>
    </div>
  );
}
