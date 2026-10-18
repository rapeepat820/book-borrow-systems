import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, saveSession } from '../api';
import Logo from '../components/Logo';
import AddressSelect from '../components/AddressSelect';
import { EyeIcon, EyeOffIcon } from '../components/Icons';

export default function Register() {
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirm: '', phone: '',
    address_detail: '', province: '', district: '', subdistrict: '', postal_code: ''
  });
  const [agree, setAgree] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
    if (!agree) return setError('กรุณายอมรับข้อกำหนดและเงื่อนไข และนโยบายความเป็นส่วนตัวก่อนสมัครสมาชิก');
    setLoading(true);
    try {
      const { confirm, ...payload } = form;
      const data = await api.register(payload);
      saveSession(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <Logo />
        <h2>ลงทะเบียน</h2>
        <p className="subtitle">สร้างบัญชีเพื่อเริ่มยืมหนังสือกับเรา</p>

        <form onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          <label>ชื่อ-นามสกุล<span className="required-mark">*</span></label>
          <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />

          <label>อีเมล<span className="required-mark">*</span></label>
          <input type="email" placeholder="example@gmail.com" required
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />

          <label>เบอร์โทรศัพท์</label>
          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />

          <label>ที่อยู่สำหรับจัดส่งหนังสือ<span className="required-mark">*</span></label>
          <p className="muted" style={{ margin: '0 0 6px', fontSize: 12.5 }}>
            ระบบจะใช้ที่อยู่นี้ในการจัดส่งหนังสือทุกครั้งที่คุณยืม โดยไม่ต้องกรอกใหม่อีก (แก้ไขได้ภายหลังที่หน้าโปรไฟล์)
          </p>
          <input required placeholder="บ้านเลขที่ / หมู่บ้าน / ซอย / ถนน"
            value={form.address_detail} onChange={e => setForm({ ...form, address_detail: e.target.value })} />
          <AddressSelect
            value={form}
            onChange={patch => setForm({ ...form, ...patch })}
          />

          <label>รหัสผ่าน<span className="required-mark">*</span></label>
          <div className="input-with-icon">
            <input type={showPw ? 'text' : 'password'} placeholder="อย่างน้อย 8 ตัวอักษร" required minLength={6}
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            <button type="button" className="icon-right" onClick={() => setShowPw(!showPw)}>
              {showPw ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
            </button>
          </div>

          <label>ยืนยันรหัสผ่าน<span className="required-mark">*</span></label>
          <input type={showPw ? 'text' : 'password'} required
            value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} />

          <label className="checkbox-row" style={{ margin: '16px 0 0' }}>
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
            ฉันยอมรับ <Link to="/terms" className="btn-link">ข้อกำหนดและเงื่อนไข</Link> และรับทราบ
            <Link to="/privacy" className="btn-link"> นโยบายความเป็นส่วนตัว</Link> เกี่ยวกับการเก็บและใช้ข้อมูลส่วนบุคคลของฉัน
          </label>

          <button className="btn-primary" style={{ marginTop: 18 }} disabled={loading}>
            {loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
          </button>
        </form>

        <p className="footnote">มีบัญชีอยู่แล้ว? <Link to="/login" className="btn-link">เข้าสู่ระบบ</Link></p>
      </div>
    </div>
  );
}
