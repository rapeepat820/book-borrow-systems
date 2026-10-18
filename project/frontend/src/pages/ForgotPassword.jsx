import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Logo from '../components/Logo';
import { ChevronLeftIcon } from '../components/Icons';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <Link to="/login" className="back-circle"><ChevronLeftIcon size={18} /></Link>
        <Logo />
        <h2>ลืมรหัสผ่าน</h2>
        <p className="subtitle">กรอกอีเมลที่ใช้สมัครสมาชิก เราจะส่งลิงก์สำหรับสร้างรหัสผ่านใหม่ให้ทางอีเมล</p>

        {sent ? (
          <p className="pill pill-green" style={{ display: 'block', textAlign: 'center', padding: 14 }}>
            ส่งลิงก์สร้างรหัสผ่านใหม่ไปที่อีเมลของคุณแล้ว กรุณาตรวจสอบกล่องจดหมาย
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <p className="error-text">{error}</p>}
            <label>อีเมล</label>
            <input type="email" required placeholder="example@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
            <button className="btn-primary" style={{ marginTop: 18 }} disabled={loading}>
              {loading ? 'กำลังส่ง...' : 'ส่งลิงก์สร้างรหัสผ่านใหม่'}
            </button>
          </form>
        )}
        <p className="footnote">นึกรหัสผ่านออกแล้ว? <Link to="/login" className="btn-link">เข้าสู่ระบบ</Link></p>
      </div>
    </div>
  );
}
