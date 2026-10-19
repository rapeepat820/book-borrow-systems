import { useEffect, useState } from 'react';
import { api } from '../../api';

const STATUS_LABEL = { new: 'ใหม่', replied: 'ตอบแล้ว', closed: 'ปิดเรื่อง' };
const STATUS_CLASS = { new: 'pill-amber', replied: 'pill-green', closed: 'pill-blue' };

const FIELDS = [
  { key: 'shop_name', label: 'ชื่อร้าน', placeholder: 'RP Bookstore' },
  { key: 'phone', label: 'เบอร์โทรศัพท์', placeholder: '081-234-5678' },
  { key: 'line_id', label: 'LINE ID (ที่แสดงให้ลูกค้าเห็น)', placeholder: '@rpbookstore' },
  { key: 'line_url', label: 'ลิงก์ LINE (ไม่บังคับ — ลูกค้ากดแล้วเปิด LINE ได้เลย)', placeholder: 'https://line.me/R/ti/p/@rpbookstore' },
  { key: 'email', label: 'อีเมลร้าน (ใช้แจ้งเตือนเมื่อมีข้อความใหม่ด้วย)', placeholder: 'shop@example.com' },
  { key: 'facebook_url', label: 'ลิงก์ Facebook เพจ', placeholder: 'https://facebook.com/...' },
  { key: 'hours', label: 'เวลาทำการ', placeholder: 'จันทร์-ศุกร์ 9:00-18:00 น.' }
];

export default function AdminContact() {
  const [tab, setTab] = useState('messages');
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState('new');
  const [loadError, setLoadError] = useState('');
  const [active, setActive] = useState(null);
  const [reply, setReply] = useState('');
  const [replyMsg, setReplyMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [settings, setSettings] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');

  function loadMessages() {
    setLoadError('');
    api.adminGetContactMessages(filter).then(setMessages).catch(err => setLoadError(err.message));
  }
  useEffect(loadMessages, [filter]);
  useEffect(() => { api.adminGetContactSettings().then(setSettings).catch(err => setSaveMsg(err.message)); }, []);

  function openMessage(m) {
    setActive(m);
    setReply(m.admin_reply || '');
    setReplyMsg('');
  }

  async function handleReply(e) {
    e.preventDefault();
    setBusy(true);
    setReplyMsg('');
    try {
      const result = await api.adminReplyContact(active.id, reply);
      setReplyMsg(result.message);
      loadMessages();
      setTimeout(() => setActive(null), 1200);
    } catch (err) {
      setReplyMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStatus(id, status) {
    await api.adminSetContactStatus(id, status);
    setActive(null);
    loadMessages();
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSaveMsg('');
    try {
      const result = await api.adminSaveContactSettings(settings);
      setSaveMsg(result.message);
    } catch (err) {
      setSaveMsg(err.message);
    }
  }

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>ข้อความติดต่อ</h1>
          <p className="muted" style={{ margin: 0 }}>ข้อความจากลูกค้าและการตั้งค่าช่องทางติดต่อของร้าน</p>
        </div>
      </div>

      <div className="chip-row">
        <button className={`chip${tab === 'messages' ? ' active' : ''}`} onClick={() => setTab('messages')}>ข้อความจากลูกค้า</button>
        <button className={`chip${tab === 'settings' ? ' active' : ''}`} onClick={() => setTab('settings')}>ตั้งค่าช่องทางติดต่อ</button>
      </div>

      {tab === 'messages' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-toolbar">
            <select value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">ทุกสถานะ</option>
              <option value="new">ใหม่ (รอตอบ)</option>
              <option value="replied">ตอบแล้ว</option>
              <option value="closed">ปิดเรื่อง</option>
            </select>
          </div>
          {loadError && <p className="error-text" style={{ padding: '0 16px' }}>{loadError}</p>}
          <table className="data-table">
            <thead><tr><th>วันที่</th><th>ลูกค้า</th><th>หัวข้อ</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
            <tbody>
              {messages.map(m => (
                <tr key={m.id}>
                  <td>{String(m.created_at).slice(0, 10)}</td>
                  <td>{m.name}<br /><span className="muted">{m.email}</span></td>
                  <td>
                    {m.subject}
                    {m.record_id && <div className="muted" style={{ fontSize: 12 }}>รายการยืม #{m.record_id} {m.record_title ? `— ${m.record_title}` : ''}</div>}
                    <div className="muted" style={{ fontSize: 12.5, maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.message}</div>
                  </td>
                  <td><span className={`pill ${STATUS_CLASS[m.status]}`}>{STATUS_LABEL[m.status]}</span></td>
                  <td><button className="btn-link" onClick={() => openMessage(m)}>{m.status === 'new' ? 'อ่านและตอบ' : 'ดู'}</button></td>
                </tr>
              ))}
              {messages.length === 0 && !loadError && <tr><td colSpan={5} className="muted">ไม่มีข้อความ</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'settings' && (
        <form className="card" onSubmit={handleSaveSettings}>
          <p className="muted" style={{ marginTop: 0 }}>ข้อมูลเหล่านี้จะแสดงในหน้า "ติดต่อเจ้าหน้าที่" ของลูกค้า ช่องที่เว้นว่างจะไม่แสดง</p>
          {!settings ? <p className="muted">กำลังโหลด...</p> : (
            <>
              {FIELDS.map(f => (
                <div key={f.key}>
                  <label>{f.label}</label>
                  <input placeholder={f.placeholder} value={settings[f.key] || ''} onChange={e => setSettings({ ...settings, [f.key]: e.target.value })} />
                </div>
              ))}
              <label>ที่ตั้งร้าน</label>
              <textarea rows={3} value={settings.address || ''} onChange={e => setSettings({ ...settings, address: e.target.value })} />
              <label>ประกาศสั้นๆ (แสดงเป็นกล่องเตือนด้านบนหน้าติดต่อ เช่น วันหยุด)</label>
              <input value={settings.note || ''} onChange={e => setSettings({ ...settings, note: e.target.value })} />
              {saveMsg && <p className="pill pill-blue" style={{ display: 'block', padding: 10, marginTop: 10 }}>{saveMsg}</p>}
              <button className="btn-primary auto" style={{ marginTop: 14 }}>บันทึก</button>
            </>
          )}
        </form>
      )}

      {active && (
        <div className="modal-backdrop" onClick={() => setActive(null)}>
          <form className="modal-box" onClick={e => e.stopPropagation()} onSubmit={handleReply}>
            <h3>{active.subject}</h3>
            <p className="muted" style={{ marginBottom: 6 }}>
              {active.name} · {active.email}{active.phone ? ` · ${active.phone}` : ''}<br />
              {String(active.created_at).slice(0, 16).replace('T', ' ')}
              {active.record_id ? ` · รายการยืม #${active.record_id}` : ''}
            </p>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.7, padding: 10, borderRadius: 10, background: 'rgba(127,127,127,.12)' }}>{active.message}</p>
            <label>ตอบกลับ (ส่งทางอีเมลถึงลูกค้า)</label>
            <textarea required rows={5} maxLength={3000} value={reply} onChange={e => setReply(e.target.value)} />
            {replyMsg && <p className="pill pill-blue" style={{ display: 'block', padding: 10 }}>{replyMsg}</p>}
            <div className="btn-row">
              <button type="button" className="btn-outline" onClick={() => setActive(null)}>ปิด</button>
              {active.status !== 'closed' && <button type="button" className="btn-outline" onClick={() => handleStatus(active.id, 'closed')}>ปิดเรื่อง</button>}
              <button className="btn-primary" disabled={busy}>{busy ? 'กำลังส่ง...' : 'ส่งคำตอบ'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
