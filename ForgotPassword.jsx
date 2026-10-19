import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Logo from '../components/Logo';
import { ChevronLeftIcon } from '../components/Icons';

// ขั้นที่ 1: กรอกอีเมลเพื่อรับรหัส OTP 6 หลัก  |  ขั้นที่ 2: กรอก OTP + ตั้งรหัสผ่านใหม่
export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendOtp(e) {
    if (e) e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const data = await api.forgotPassword(email.trim());
      setInfo(data.message);
      setStep(2);
      setCooldown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
    setLoading(true);
    try {
      await api.resetPassword(email.trim(), otp.trim(), password);
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
        <Link to="/login" className="back-circle"><ChevronLeftIcon size={18} /></Link>
        <Logo />
        <h2>ลืมรหัสผ่าน</h2>

        {step === 1 ? (
          <>
            <p className="subtitle">กรอกอีเมลที่ใช้สมัครสมาชิก เราจะส่งรหัส OTP 6 หลักไปให้ทางอีเมล</p>
            <form onSubmit={sendOtp}>
              {error && <p className="error-text">{error}</p>}
              <label>อีเมล</label>
              <input type="email" required placeholder="example@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
              <button className="btn-primary" style={{ marginTop: 18 }} disabled={loading}>
                {loading ? 'กำลังส่ง...' : 'ส่งรหัส OTP'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="subtitle">กรอกรหัส OTP 6 หลักที่ส่งไปยัง {email} แล้วตั้งรหัสผ่านใหม่</p>
            {info && <p className="pill pill-green" style={{ display: 'block', textAlign: 'center', padding: 12, marginBottom: 12 }}>{info}</p>}
            <form onSubmit={submitReset}>
              {error && <p className="error-text">{error}</p>}
              <label>รหัส OTP</label>
              <input
                inputMode="numeric" autoComplete="one-time-code" required maxLength={6} pattern="\d{6}"
                placeholder="000000" value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                style={{ letterSpacing: 8, textAlign: 'center', fontSize: 22 }}
              />
              <label>รหัสผ่านใหม่</label>
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
              <label>ยืนยันรหัสผ่านใหม่</label>
              <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
              <button className="btn-primary" style={{ marginTop: 18 }} disabled={loading}>
                {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
              </button>
            </form>
            <p className="footnote">
              ไม่ได้รับรหัส?{' '}
              <button type="button" className="btn-link" disabled={cooldown > 0 || loading} onClick={() => sendOtp()}>
                {cooldown > 0 ? `ส่งใหม่ได้ใน ${cooldown} วินาที` : 'ส่งรหัสอีกครั้ง'}
              </button>
            </p>
          </>
        )}
        <p className="footnote">นึกรหัสผ่านออกแล้ว? <Link to="/login" className="btn-link">เข้าสู่ระบบ</Link></p>
      </div>
    </div>
  );
}
