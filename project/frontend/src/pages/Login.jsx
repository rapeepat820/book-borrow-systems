import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, saveSession } from '../api';
import Logo from '../components/Logo';
import BarChartDecoration from '../components/BarChartDecoration';
import { UserIcon, EyeIcon, EyeOffIcon } from '../components/Icons';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(form);
      saveSession(data.token, data.user);
      navigate(data.user.role === 'admin' ? '/admin' : '/');
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
        <h2>เข้าสู่ระบบ</h2>
        <p className="subtitle">ยินดีต้อนรับกลับมา กรอกข้อมูลเพื่อเข้าใช้งาน</p>

        <form onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          <label>อีเมล</label>
          <div className="input-with-icon">
            <span className="icon-left"><UserIcon size={17} /></span>
            <input type="email" placeholder="example@gmail.com" required
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>

          <label>รหัสผ่าน</label>
          <div className="input-with-icon">
            <input type={showPw ? 'text' : 'password'} placeholder="••••••••" required
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            <button type="button" className="icon-right" onClick={() => setShowPw(!showPw)}>
              {showPw ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
            </button>
          </div>

          <div style={{ textAlign: 'right', marginTop: 6 }}>
            <Link to="/forgot-password" className="btn-link">ลืมรหัสผ่าน?</Link>
          </div>

          <button className="btn-primary" style={{ marginTop: 18 }} disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ →'}
          </button>
        </form>

        <p className="footnote">ยังไม่มีบัญชี? <Link to="/register" className="btn-link">สมัครสมาชิก</Link></p>
        <BarChartDecoration />
      </div>
    </div>
  );
}
