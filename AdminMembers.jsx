import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { PlusIcon, EditIcon } from '../../components/Icons';

const EMPTY = { full_name: '', email: '', phone: '', address: '' };

export default function AdminMembers() {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function load() { api.adminGetMembers().then(setMembers); }
  useEffect(load, []);

  const filtered = useMemo(() =>
    members.filter(m => (m.full_name + m.email).toLowerCase().includes(search.toLowerCase())),
    [members, search]
  );

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      const result = await api.adminCreateMember(form);
      setNotice(`เพิ่มลูกค้าสำเร็จ — รหัสผ่านชั่วคราว: ${result.temp_password} (แนะนำให้ลูกค้าตั้งรหัสใหม่ผ่าน "ลืมรหัสผ่าน")`);
      setForm(EMPTY);
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>รายชื่อลูกค้า</h1>
          <p className="muted" style={{ margin: 0 }}>ข้อมูลสรุปรายชื่อลูกค้าและสถานะสมาชิกปัจจุบัน</p>
        </div>
      </div>

      {notice && <p className="pill pill-green" style={{ display: 'block', padding: 12, marginBottom: 14 }}>{notice}</p>}

      <div className="table-toolbar">
        <input placeholder="ค้นหารายชื่อ..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
        <button className="btn-primary auto" onClick={() => setShowModal(true)}><PlusIcon size={16} /> เพิ่มลูกค้า</button>
      </div>

      <table className="data-table">
        <thead><tr><th>ชื่อ-นามสกุล</th><th>อีเมล</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
        <tbody>
          {filtered.map(m => (
            <tr key={m.id}>
              <td>{m.full_name}</td>
              <td>{m.email}</td>
              <td><span className="pill pill-green">ปกติ</span></td>
              <td><button className="btn-link" title="แก้ไข"><EditIcon size={15} /></button></td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={4} className="muted">ไม่พบข้อมูลลูกค้า</td></tr>}
        </tbody>
      </table>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form className="modal-box" onClick={e => e.stopPropagation()} onSubmit={handleCreate}>
            <h3>เพิ่มลูกค้าใหม่</h3>
            {error && <p className="error-text">{error}</p>}
            <label>ชื่อ-นามสกุล</label>
            <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            <label>อีเมล</label>
            <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <label>เบอร์โทรศัพท์</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <label>ที่อยู่</label>
            <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            <div className="btn-row">
              <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>ยกเลิก</button>
              <button className="btn-primary">บันทึก</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
