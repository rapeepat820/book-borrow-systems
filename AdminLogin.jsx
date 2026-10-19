import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, saveSession } from '../../api';
import Logo from '../../components/Logo';
import BarChartDecoration from '../../components/BarChartDecoration';
import { EyeIcon, EyeOffIcon } from '../../components/Icons';

export default function AdminLogin() {
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
      if (data.user.role !== 'admin') {
        setError('บัญชีนี้ไม่มีสิทธิ์เข้าสู่ระบบแอดมิน');
        setLoading(false);
        return;
      }
      saveSession(data.token, data.user);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div style={{ width: '100%', maxWidth: 380 }}>
        <p className="muted" style={{ marginBottom: 8 }}>เข้าสู่ระบบ admin</p>
        <div className="card auth-card">
          <Logo />
          <h2>เข้าสู่ระบบ</h2>

          <form onSubmit={handleSubmit}>
            {error && <p className="error-text">{error}</p>}
            <label>อีเมล หรือ ชื่อผู้ใช้งาน</label>
            <input required placeholder="admin" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />

            <label>รหัสผ่าน</label>
            <div className="input-with-icon">
              <input type={showPw ? 'text' : 'password'} required placeholder="••••••••"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              <button type="button" className="icon-right" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
              </button>
            </div>

            <button className="btn-primary" style={{ marginTop: 18 }} disabled={loading}>
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ →'}
            </button>
          </form>
          <BarChartDecoration />
        </div>
      </div>
    </div>
  );
}
