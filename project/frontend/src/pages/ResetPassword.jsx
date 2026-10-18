import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import Logo from '../components/Logo';
import BarChartDecoration from '../components/BarChartDecoration';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
    if (!token) return setError('ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ใหม่จากหน้า "ลืมรหัสผ่าน"');
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      navigate('/login');
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
        <h2>สร้างรหัสผ่านใหม่</h2>
        <p className="subtitle">ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>

        <form onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          <label>รหัสผ่านใหม่</label>
          <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
          <label>ยืนยันรหัสผ่านใหม่</label>
          <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
          <button className="btn-primary" style={{ marginTop: 18 }} disabled={loading}>
            {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
          </button>
        </form>
        <p className="footnote"><Link to="/login" className="btn-link">กลับไปเข้าสู่ระบบ</Link></p>
        <BarChartDecoration />
      </div>
    </div>
  );
}
