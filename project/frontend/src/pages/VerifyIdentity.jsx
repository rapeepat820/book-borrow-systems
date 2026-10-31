import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import IdentityFields, { EMPTY_IDENTITY, appendIdentity, identityError } from '../components/IdentityFields';
import { ChevronLeftIcon } from '../components/Icons';

export default function VerifyIdentity() {
  const [st, setSt] = useState(null);
  const [form, setForm] = useState(EMPTY_IDENTITY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function load() { api.getIdentityStatus().then(setSt).catch(e => setError(e.message)); }
  useEffect(load, []);

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
        <Link to="/menu" className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">ยืนยันตัวตน</span>
      </div>
      {!st ? <p className="muted">กำลังโหลด...</p> : st.status === 'verified' ? (
        <div className="card"><p className="pill pill-green" style={{ display: 'block', padding: 12 }}>ยืนยันตัวตนแล้ว{st.last4 ? ` (เลขบัตรลงท้าย ${st.last4})` : ''} — ยืมหนังสือได้ตามปกติ</p>
          <p className="muted" style={{ marginBottom: 0 }}>รูปบัตรและเซลฟี่ของคุณถูกลบออกจากระบบแล้ว</p></div>
      ) : st.status === 'pending' ? (
        <div className="card"><p className="pill pill-amber" style={{ display: 'block', padding: 12 }}>ส่งข้อมูลแล้ว รอแอดมินตรวจสอบ</p>
          <p className="muted" style={{ marginBottom: 0 }}>เมื่อตรวจเสร็จเราจะแจ้งทางอีเมล และคุณจะยืมหนังสือได้ทันที</p></div>
      ) : (
        <form onSubmit={handleSubmit}>
          {st.status === 'rejected' && (
            <div className="warning-box"><span>การยืนยันตัวตนครั้งก่อนไม่ผ่าน{st.reject_reason ? `: ${st.reject_reason}` : ''} กรุณาส่งใหม่</span></div>
          )}
          <p className="muted">ต้องยืนยันตัวตนก่อนยืมหนังสือ เพื่อป้องกันการหลอกลวงและการสมัครซ้ำ</p>
          <IdentityFields value={form} onChange={patch => setForm(f => ({ ...f, ...patch }))} />
          {error && <p className="error-text">{error}</p>}
          <button className="btn-primary" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'กำลังส่ง...' : 'ส่งข้อมูลยืนยันตัวตน'}</button>
        </form>
      )}
    </div>
  );
}
