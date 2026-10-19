import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import AddressSelect from '../components/AddressSelect';
import RefundAccountFields, { EMPTY_REFUND, refundFromProfile } from '../components/RefundAccountFields';
import { ChevronLeftIcon } from '../components/Icons';

const EMPTY = { full_name: '', phone: '', address_detail: '', province: '', district: '', subdistrict: '', postal_code: '', ...EMPTY_REFUND };

export default function EditProfile() {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getMe().then(me => {
      setForm({
        full_name: me.full_name || '',
        phone: me.phone || '',
        address_detail: me.address_detail || '',
        province: me.province || '',
        district: me.district || '',
        subdistrict: me.subdistrict || '',
        postal_code: me.postal_code || '',
        ...refundFromProfile(me)
      });
      setLoading(false);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.updateMe(form);
      setDone(true);
      setTimeout(() => navigate('/profile'), 900);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="book-detail-header">
        <Link to="/menu" className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">แก้ไขโปรไฟล์</span>
      </div>

      {loading ? <p className="muted">กำลังโหลด...</p> : (
        <form className="card" onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          {done && <p className="pill pill-green" style={{ display: 'block', padding: 12 }}>บันทึกข้อมูลสำเร็จ</p>}
          <label>ชื่อ-นามสกุล<span className="required-mark">*</span></label>
          <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          <label>เบอร์โทรศัพท์</label>
          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />

          <label>ที่อยู่สำหรับจัดส่งหนังสือ<span className="required-mark">*</span></label>
          <p className="muted" style={{ margin: '0 0 6px', fontSize: 12.5 }}>
            ที่อยู่นี้จะถูกใช้จัดส่งหนังสือทุกครั้งที่คุณยืมโดยอัตโนมัติ
          </p>
          <input required placeholder="บ้านเลขที่ / หมู่บ้าน / ซอย / ถนน"
            value={form.address_detail} onChange={e => setForm({ ...form, address_detail: e.target.value })} />
          <AddressSelect value={form} onChange={patch => setForm({ ...form, ...patch })} />

          <label style={{ marginTop: 18 }}>บัญชีรับเงินมัดจำคืน</label>
          <p className="muted" style={{ margin: '0 0 6px', fontSize: 12.5 }}>
            เมื่อคืนหนังสือแล้ว เราจะโอนเงินมัดจำ (หักค่าปรับถ้ามี) เข้าบัญชีนี้ คุณแก้ไขได้อีกครั้งตอนแจ้งคืนหนังสือ
          </p>
          <RefundAccountFields value={form} onChange={patch => setForm({ ...form, ...patch })} />

          <button className="btn-primary" style={{ marginTop: 16 }}>บันทึกการเปลี่ยนแปลง</button>
        </form>
      )}
    </div>
  );
}
