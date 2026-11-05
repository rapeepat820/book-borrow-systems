import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import IdentityFields, { EMPTY_IDENTITY, appendIdentity, identityError } from '../components/IdentityFields';
import { ChevronLeftIcon } from '../components/Icons';

export default function VerifyIdentity() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const fromRegister = !!(state && state.fromRegister);
  const [st, setSt] = useState(null);
  const [form, setForm] = useState(EMPTY_IDENTITY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function load() { api.getIdentityStatus().then(setSt).catch(e => setError(e.message)); }
  useEffect(load, []);
  // ร้านปิดการบังคับยืนยันตัวตน หรือยืนยันแล้ว → ไม่ต้องอยู่หน้านี้ตอนมาจากการสมัคร
  useEffect(() => {
    if (fromRegister && st && (!st.required || st.status === 'verified')) navigate('/', { replace: true });
  }, [st]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    const msg = identityError(form);
    if (msg) return setError(msg);
    setError('');
    setBusy(true);
    try {
      const fd = new FormData();
      appendIdentity(fd, form);
      await api.submitIdentity(fd);
      setForm(EMPTY_IDENTITY);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="book-detail-header">
        {!fromRegister && <Link to="/menu" className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>}
        <span className="book-detail-title">ยืนยันตัวตน</span>
      </div>
      {fromRegister && (
        <div style={{ display: 'flex', gap: 8, margin: '0 0 12px', fontSize: 13 }}>
          <span className="pill pill-green">ขั้นที่ 1 สร้างบัญชีแล้ว ✓</span>
          <span className="pill pill-blue">ขั้นที่ 2 ยืนยันตัวตน</span>
        </div>
      )}
      {!st ? <p className="muted">กำลังโหลด...</p> : st.status === 'verified' ? (
        <div className="card"><p className="pill pill-green" style={{ display: 'block', padding: 12 }}>ยืนยันตัวตนแล้ว{st.last4 && <> <span className="nb">(เลขบัตรลงท้าย {st.last4})</span></>} — ยืมหนังสือได้ตามปกติ</p>
          <p className="muted" style={{ marginBottom: 0 }}>รูปบัตรและเซลฟี่ของคุณถูกลบออกจากระบบแล้ว</p></div>
      ) : st.status === 'pending' ? (
        <div className="card"><p className="pill pill-amber" style={{ display: 'block', padding: 12 }}>ส่งข้อมูลแล้ว รอแอดมินตรวจสอบ</p>
          <p className="muted">เมื่อตรวจเสร็จเราจะแจ้งทางอีเมล และคุณจะยืมหนังสือได้ทันที ระหว่างรอเลือกดูหนังสือหรือเพิ่มลงตะกร้าไว้ก่อนได้</p>
          <Link to="/" className="btn-primary">ไปหน้าแรก</Link></div>
      ) : (
        <form onSubmit={handleSubmit}>
          {st.status === 'rejected' && (
            <div className="warning-box"><span>การยืนยันตัวตนครั้งก่อนไม่ผ่าน{st.reject_reason ? `: ${st.reject_reason}` : ''} กรุณาส่งใหม่</span></div>
          )}
          <p className="muted">ต้องยืนยันตัวตนก่อนยืมหนังสือ เพื่อป้องกันการหลอกลวงและการสมัครซ้ำ</p>
          <IdentityFields compact value={form} onChange={patch => setForm(f => ({ ...f, ...patch }))} />
          {error && <p className="error-text">{error}</p>}
          <button className="btn-primary" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'กำลังส่ง...' : 'ส่งข้อมูลยืนยันตัวตน'}</button>
          {fromRegister && (
            <p className="footnote">ยังไม่พร้อม? <Link to="/" className="btn-link">ข้ามไปก่อน</Link><br /><span className="muted">เลือกดูหนังสือได้ แต่ต้องยืนยันตัวตนก่อนจึงจะยืมได้</span></p>
          )}
        </form>
      )}
    </div>
  );
}
