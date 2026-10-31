import { useEffect, useState } from 'react';
import { api } from '../../api';

const fmtId = d => (d && d.length === 13 ? `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}` : d);

export default function AdminIdentity() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);
  const [imgs, setImgs] = useState({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  function load() { setError(''); api.adminGetIdVerifications(status).then(setRows).catch(e => setError(e.message)); }
  useEffect(load, [status]);

  async function openItem(r) {
    setActive(r); setReason(''); setMsg(''); setImgs({});
    if (r.has_images) {
      const [card, selfie] = await Promise.all([api.adminFetchIdImage(r.id, 'card').catch(() => ''), api.adminFetchIdImage(r.id, 'selfie').catch(() => '')]);
      setImgs({ card, selfie });
    }
  }
  function closeItem() { Object.values(imgs).forEach(u => u && URL.revokeObjectURL(u)); setActive(null); setImgs({}); }

  async function decide(approve) {
    setBusy(true); setMsg('');
    try {
      const r = approve ? await api.adminApproveId(active.id) : await api.adminRejectId(active.id, reason);
      setMsg(r.message);
      load();
      setTimeout(closeItem, 900);
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="admin-header">
        <div><h1>ยืนยันตัวตนสมาชิก</h1>
          <p className="muted" style={{ margin: 0 }}>ตรวจเลขบัตร รูปบัตร และเซลฟี่ถือบัตร เมื่ออนุมัติหรือปฏิเสธ ระบบจะลบรูปและเลขบัตรเต็มทิ้งทันที</p></div>
      </div>
      <div className="chip-row">
        {[['pending', 'รอตรวจสอบ'], ['approved', 'ผ่านแล้ว'], ['rejected', 'ไม่ผ่าน']].map(([k, v]) => (
          <button key={k} className={`chip${status === k ? ' active' : ''}`} onClick={() => setStatus(k)}>{v}</button>
        ))}
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="card" style={{ padding: 0 }}>
        <table className="data-table">
          <thead><tr><th>ส่งเมื่อ</th><th>สมาชิก</th><th>เลขบัตร</th><th>{status === 'pending' ? 'จัดการ' : 'ผล'}</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{String(r.created_at).slice(0, 16).replace('T', ' ')}</td>
                <td>{r.full_name}<br /><span className="muted">{r.email}{r.phone ? ` · ${r.phone}` : ''}</span></td>
                <td>{r.id_number ? fmtId(r.id_number) : `x-xxxx-xxxxx-xx-${r.id_last4?.slice(-1) || 'x'} (ลงท้าย ${r.id_last4})`}
                  {r.duplicate_of && <div style={{ color: 'var(--danger)', fontSize: 12 }}>เลขนี้ยืนยันกับบัญชีอื่นแล้ว: {r.duplicate_of}</div>}</td>
                <td>{status === 'pending'
                  ? <button className="btn-link" onClick={() => openItem(r)}>ตรวจสอบ</button>
                  : <span className={`pill ${status === 'approved' ? 'pill-green' : 'pill-amber'}`}>{status === 'approved' ? 'ผ่าน' : `ไม่ผ่าน${r.reject_reason ? `: ${r.reject_reason}` : ''}`}</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && <tr><td colSpan={4} className="muted">ไม่มีรายการ</td></tr>}
          </tbody>
        </table>
      </div>

      {active && (
        <div className="modal-backdrop" onClick={closeItem}>
          <div className="modal-box" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h3>{active.full_name}</h3>
            <p className="muted" style={{ margin: '0 0 6px' }}>{active.email} · เลขบัตรที่กรอก: <b>{fmtId(active.id_number)}</b></p>
            {active.duplicate_of && <p style={{ color: 'var(--danger)', fontSize: 13 }}>เตือน: เลขนี้ถูกยืนยันกับบัญชีของ "{active.duplicate_of}" แล้ว ไม่ควรอนุมัติ</p>}
            <p style={{ fontSize: 13, margin: '6px 0' }}>ตรวจ: ชื่อ-เลขบนบัตรตรงกับที่กรอกและชื่อสมาชิกหรือไม่ · หน้าในเซลฟี่ตรงกับรูปบนบัตรหรือไม่ · บัตรไม่ใช่รูปถ่ายจากจอหรือถูกแก้ไข</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><div className="muted" style={{ fontSize: 12 }}>รูปบัตร</div>{imgs.card ? <img src={imgs.card} alt="บัตร" style={{ width: '100%', borderRadius: 8 }} /> : <p className="muted">กำลังโหลด...</p>}</div>
              <div><div className="muted" style={{ fontSize: 12 }}>เซลฟี่ถือบัตร</div>{imgs.selfie ? <img src={imgs.selfie} alt="เซลฟี่" style={{ width: '100%', borderRadius: 8 }} /> : <p className="muted">กำลังโหลด...</p>}</div>
            </div>
            <label>เหตุผล (จำเป็นเมื่อไม่อนุมัติ — ส่งให้ผู้สมัครทางอีเมล)</label>
            <input placeholder="เช่น รูปบัตรไม่ชัด / หน้าไม่ตรงกับบัตร" value={reason} onChange={e => setReason(e.target.value)} />
            {msg && <p className="pill pill-blue" style={{ display: 'block', padding: 10, marginTop: 8 }}>{msg}</p>}
            <div className="btn-row">
              <button className="btn-outline" onClick={closeItem}>ปิด</button>
              <button className="btn-outline" disabled={busy || !reason.trim()} onClick={() => decide(false)}>ไม่อนุมัติ</button>
              <button className="btn-primary" disabled={busy} onClick={() => decide(true)}>อนุมัติ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
