import { useEffect, useState } from 'react';
import { api } from '../../api';

const EMPTY = { name: '', base_fee: 0, fee_per_book: 0, delivery_days: 1, tracking_url: '', is_active: 0 };

export default function AdminShipping() {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [activating, setActivating] = useState(null);

  function load() { api.adminGetShipping().then(setCompanies); }
  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (editingId) await api.adminUpdateShipping(editingId, form);
    else await api.adminCreateShipping(form);
    setForm(EMPTY);
    setEditingId(null);
    load();
  }

  async function handleActivate(id) {
    setActivating(id);
    try {
      await api.adminActivateShipping(id);
      load();
    } finally {
      setActivating(null);
    }
  }

  return (
    <div>
      <p className="muted">
        ระบบใช้บริษัทขนส่งเพียงบริษัทเดียวในการคำนวณค่าส่งและให้ลูกค้ายืมหนังสือ (ลูกค้าจะไม่เห็นตัวเลือกให้เปรียบเทียบ)
        — สูตรคำนวณ: ค่าจัดส่ง = ค่าเริ่มต้น + ค่าต่อเล่ม × จำนวนเล่ม และจำนวนวันจัดส่งจะถูกนำไปบวกในระยะเวลายืม-คืน
        กดปุ่ม "ตั้งเป็นบริษัทที่ใช้งาน" ในตารางด้านล่างเพื่อสลับบริษัทที่ต้องการใช้จริง (ระบบจะปิดบริษัทอื่นให้อัตโนมัติ)
      </p>
      <form className="card" onSubmit={handleSubmit}>
        <h3>{editingId ? 'แก้ไขบริษัทขนส่ง' : 'เพิ่มบริษัทขนส่งใหม่'}</h3>
        <div className="form-row">
          <div>
            <label>ชื่อบริษัท</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label>ค่าจัดส่งเริ่มต้น (บาท)</label>
            <input type="number" min="0" value={form.base_fee} onChange={e => setForm({ ...form, base_fee: e.target.value })} />
          </div>
          <div>
            <label>ค่าจัดส่งเพิ่มต่อเล่ม (บาท)</label>
            <input type="number" min="0" value={form.fee_per_book} onChange={e => setForm({ ...form, fee_per_book: e.target.value })} />
          </div>
          <div>
            <label>ระยะเวลาจัดส่งโดยประมาณ (วัน)</label>
            <input type="number" min="1" value={form.delivery_days} onChange={e => setForm({ ...form, delivery_days: e.target.value })} />
          </div>
        </div>
        <label>ลิงก์หน้าติดตามพัสดุของบริษัทขนส่ง (ให้ลูกค้ากดไปวางเลข tracking เอง)</label>
        <input placeholder="https://..." value={form.tracking_url} onChange={e => setForm({ ...form, tracking_url: e.target.value })} />
        <label className="checkbox-row" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={!!form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })} />
          ตั้งเป็นบริษัทที่ใช้งานทันทีหลังบันทึก (จะปิดบริษัทอื่นให้อัตโนมัติ)
        </label>
        <button className="btn-primary" style={{ marginTop: 14 }}>{editingId ? 'บันทึก' : 'เพิ่มบริษัทขนส่ง'}</button>
        {editingId && <button type="button" className="btn-link" onClick={() => { setEditingId(null); setForm(EMPTY); }}>ยกเลิก</button>}
      </form>

      <table className="data-table">
        <thead><tr><th>บริษัท</th><th>เริ่มต้น</th><th>ต่อเล่ม</th><th>วันจัดส่ง</th><th>สถานะ</th><th></th></tr></thead>
        <tbody>
          {companies.map(c => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.base_fee} บาท</td>
              <td>{c.fee_per_book} บาท</td>
              <td>{c.delivery_days} วัน</td>
              <td>
                {c.is_active
                  ? <span className="pill pill-green">กำลังใช้งาน</span>
                  : <span className="pill pill-gray">ไม่ได้ใช้งาน</span>}
              </td>
              <td style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {!c.is_active && (
                  <button className="btn-link" disabled={activating === c.id} onClick={() => handleActivate(c.id)}>
                    {activating === c.id ? 'กำลังตั้งค่า...' : 'ตั้งเป็นบริษัทที่ใช้งาน'}
                  </button>
                )}
                <button className="btn-link" onClick={() => { setEditingId(c.id); setForm(c); }}>แก้ไข</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
