import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, getSession } from '../api';
import { ChevronLeftIcon, PhoneIcon, MailIcon, MapPinIcon, ClockIcon, MessageIcon, GlobeIcon, AlertIcon } from '../components/Icons';

const SUBJECTS = [
  'การชำระเงิน / สลิป',
  'การจัดส่ง / พัสดุ',
  'การคืนหนังสือ / เงินมัดจำ',
  'ค่าปรับ / การต่ออายุยืม',
  'ปัญหาการใช้งานบัญชี',
  'อื่นๆ'
];

const STATUS_LABEL = { new: 'รอเจ้าหน้าที่ตอบ', replied: 'ตอบกลับแล้ว', closed: 'ปิดเรื่องแล้ว' };

export default function Contact() {
  const { user } = getSession();
  const [params] = useSearchParams();
  const [info, setInfo] = useState(null);
  const [records, setRecords] = useState([]);
  const [mine, setMine] = useState([]);
  const [form, setForm] = useState({
    name: user?.full_name || '', email: user?.email || '', phone: '',
    subject: SUBJECTS[0], message: '', borrow_record_id: params.get('record') || ''
  });
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [sending, setSending] = useState(false);

  function loadMine() {
    if (user) api.getMyContactMessages().then(setMine).catch(() => {});
  }

  useEffect(() => {
    api.getContactInfo().then(setInfo).catch(() => setInfo({}));
    if (user) {
      api.getMyBorrows().then(setRecords).catch(() => {});
      api.getMe().then(me => setForm(f => ({ ...f, phone: f.phone || me.phone || '' }))).catch(() => {});
      loadMine();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setDone('');
    setSending(true);
    try {
      const data = await api.sendContactMessage({ ...form, borrow_record_id: form.borrow_record_id || undefined });
      setDone(data.message);
      setForm(f => ({ ...f, message: '' }));
      loadMine();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const hasInfo = info && ['phone', 'line_id', 'line_url', 'email', 'facebook_url', 'address', 'hours'].some(k => info[k]);

  return (
    <div>
      <div className="book-detail-header">
        <Link to={user ? '/menu' : '/login'} className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">ติดต่อเจ้าหน้าที่</span>
      </div>

      <p className="muted" style={{ marginBottom: 14 }}>
        {info?.shop_name || 'RP Bookstore'} — มีปัญหาเรื่องการยืม การชำระเงิน หรือเงินมัดจำ ติดต่อเราได้ตามช่องทางด้านล่าง
      </p>

      {info?.note && (
        <div className="warning-box"><AlertIcon size={17} /><span>{info.note}</span></div>
      )}

      <div className="section-title">ช่องทางติดต่อ</div>
      {hasInfo ? (
        <div className="quick-list">
          {info.phone && (
            <a className="quick-list-item" href={`tel:${info.phone.replace(/[^\d+]/g, '')}`}>
              <span className="quick-list-icon"><PhoneIcon size={18} /></span>
              <span className="grow"><div className="label">โทรศัพท์</div><div className="sub">{info.phone}</div></span>
            </a>
          )}
          {(info.line_id || info.line_url) && (
            info.line_url ? (
              <a className="quick-list-item" href={info.line_url} target="_blank" rel="noopener noreferrer">
                <span className="quick-list-icon"><MessageIcon size={18} /></span>
                <span className="grow"><div className="label">LINE</div><div className="sub">{info.line_id || 'แตะเพื่อเปิด LINE'}</div></span>
              </a>
            ) : (
              <div className="quick-list-item" style={{ cursor: 'default' }}>
                <span className="quick-list-icon"><MessageIcon size={18} /></span>
                <span className="grow"><div className="label">LINE</div><div className="sub">{info.line_id}</div></span>
              </div>
            )
          )}
          {info.email && (
            <a className="quick-list-item" href={`mailto:${info.email}`}>
              <span className="quick-list-icon"><MailIcon size={18} /></span>
              <span className="grow"><div className="label">อีเมล</div><div className="sub">{info.email}</div></span>
            </a>
          )}
          {info.facebook_url && (
            <a className="quick-list-item" href={info.facebook_url} target="_blank" rel="noopener noreferrer">
              <span className="quick-list-icon"><GlobeIcon size={18} /></span>
              <span className="grow"><div className="label">Facebook</div><div className="sub">เปิดเพจร้าน</div></span>
            </a>
          )}
          {info.hours && (
            <div className="quick-list-item" style={{ cursor: 'default' }}>
              <span className="quick-list-icon"><ClockIcon size={18} /></span>
              <span className="grow"><div className="label">เวลาทำการ</div><div className="sub">{info.hours}</div></span>
            </div>
          )}
          {info.address && (
            <div className="quick-list-item" style={{ cursor: 'default' }}>
              <span className="quick-list-icon"><MapPinIcon size={18} /></span>
              <span className="grow"><div className="label">ที่ตั้งร้าน</div><div className="sub" style={{ whiteSpace: 'pre-wrap' }}>{info.address}</div></span>
            </div>
          )}
        </div>
      ) : (
        <div className="card"><p className="muted" style={{ margin: 0 }}>ส่งข้อความหาเจ้าหน้าที่ผ่านแบบฟอร์มด้านล่างได้เลย เราจะตอบกลับทางอีเมลของคุณ</p></div>
      )}

      <div className="section-title" style={{ marginTop: 20 }}>ส่งข้อความถึงเจ้าหน้าที่</div>
      <form className="card" onSubmit={handleSubmit}>
        {done && <p className="pill pill-green" style={{ display: 'block', padding: 12 }}>{done}</p>}
        {error && <p className="error-text">{error}</p>}
        <label>ชื่อ<span className="required-mark">*</span></label>
        <input required maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <label>อีเมลสำหรับรับคำตอบ<span className="required-mark">*</span></label>
        <input required type="email" maxLength={150} placeholder="example@gmail.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <label>เบอร์โทร (ไม่บังคับ)</label>
        <input inputMode="tel" maxLength={20} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <label>หัวข้อ<span className="required-mark">*</span></label>
        <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {user && records.length > 0 && (
          <>
            <label>รายการยืมที่เกี่ยวข้อง (ไม่บังคับ)</label>
            <select value={form.borrow_record_id} onChange={e => setForm({ ...form, borrow_record_id: e.target.value })}>
              <option value="">ไม่ระบุ</option>
              {records.map(r => <option key={r.id} value={r.id}>#{r.id} — {r.title}</option>)}
            </select>
          </>
        )}
        <label>รายละเอียด<span className="required-mark">*</span></label>
        <textarea required minLength={10} maxLength={2000} rows={5} placeholder="อธิบายปัญหาหรือคำถามของคุณ"
          value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
        <button className="btn-primary" style={{ marginTop: 14 }} disabled={sending}>{sending ? 'กำลังส่ง...' : 'ส่งข้อความ'}</button>
        <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>เราจะตอบกลับทางอีเมลที่คุณระบุ โปรดอย่าใส่รหัสผ่านหรือข้อมูลบัตรในข้อความ</p>
      </form>

      {user && mine.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 20 }}>ข้อความของฉัน</div>
          <div className="record-list">
            {mine.map(m => (
              <div key={m.id} className="card">
                <div className="record-header">
                  <h3 style={{ fontSize: 14.5 }}>{m.subject}</h3>
                  <span className={`pill ${m.status === 'new' ? 'pill-amber' : 'pill-green'}`}>{STATUS_LABEL[m.status]}</span>
                </div>
                <p className="muted" style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{m.message}</p>
                {m.admin_reply && (
                  <p style={{ margin: '8px 0 0', padding: 10, borderRadius: 10, background: 'var(--surface-2, rgba(127,127,127,.12))', whiteSpace: 'pre-wrap', fontSize: 14 }}>
                    <b>เจ้าหน้าที่ตอบ:</b> {m.admin_reply}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
