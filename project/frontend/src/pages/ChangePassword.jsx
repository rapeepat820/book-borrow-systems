import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ChevronLeftIcon } from '../components/Icons';

export default function ChangePassword() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.new_password !== form.confirm) return setError('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
    setLoading(true);
    try {
      await api.changePassword({ current_password: form.current_password, new_password: form.new_password });
      navigate('/menu');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="book-detail-header">
        <Link to="/menu" className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">เปลี่ยนรหัสผ่าน</span>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        {error && <p className="error-text">{error}</p>}
        <label>รหัสผ่านปัจจุบัน</label>
        <input type="password" required value={form.current_password} onChange={e => setForm({ ...form, current_password: e.target.value })} />
        <label>รหัสผ่านใหม่</label>
        <input type="password" required minLength={6} value={form.new_password} onChange={e => setForm({ ...form, new_password: e.target.value })} />
        <label>ยืนยันรหัสผ่านใหม่</label>
        <input type="password" required value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} />
        <button className="btn-primary" style={{ marginTop: 16 }} disabled={loading}>
          {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
        </button>
      </form>
    </div>
  );
}
