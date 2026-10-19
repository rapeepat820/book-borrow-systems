import { useEffect, useState } from 'react';
import { api } from '../../api';
import { gradientFor } from '../../utils/coverArt';
import { BookStackIcon, PlusIcon, EditIcon, TrashIcon } from '../../components/Icons';

const EMPTY = { type_name: '', borrow_days: 7, deposit_amount: 0 };

export default function AdminBookTypes() {
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  function load() { api.adminGetBookTypes().then(setTypes); }
  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) await api.adminUpdateBookType(editingId, form);
      else await api.adminCreateBookType(form);
      setForm(EMPTY);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(t) {
    setEditingId(t.id);
    setForm({ type_name: t.type_name, borrow_days: t.borrow_days, deposit_amount: t.deposit_amount });
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
    setError('');
  }

  async function confirmDelete() {
    setDeleteError('');
    try {
      await api.adminDeleteBookType(deleteTarget.id);
      setDeleteTarget(null);
      if (editingId === deleteTarget.id) cancelEdit();
      load();
    } catch (err) {
      setDeleteError(err.message);
    }
  }

  return (
    <div>
      <p className="muted">กำหนดจำนวนวันที่ยืมได้ และค่ามัดจำมาตรฐาน แยกตามหมวดหมู่/ประเภทหนังสือ (ข้อ 4 และ 6)</p>

      <form className="card" onSubmit={handleSubmit}>
        <h3>{editingId ? `แก้ไขหมวดหมู่ "${types.find(t => t.id === editingId)?.type_name || ''}"` : 'เพิ่มหมวดหมู่หนังสือใหม่'}</h3>
        {error && <p className="error-text">{error}</p>}
        <div className="form-row">
          <div>
            <label>ชื่อหมวดหมู่</label>
            <input required placeholder="เช่น นิยายวิทยาศาสตร์, การ์ตูนญี่ปุ่น"
              value={form.type_name} onChange={e => setForm({ ...form, type_name: e.target.value })} />
          </div>
          <div>
            <label>จำนวนวันที่ยืมได้</label>
            <input type="number" min="1" required value={form.borrow_days} onChange={e => setForm({ ...form, borrow_days: e.target.value })} />
          </div>
          <div>
            <label>ค่ามัดจำมาตรฐาน (บาท)</label>
            <input type="number" min="0" required value={form.deposit_amount} onChange={e => setForm({ ...form, deposit_amount: e.target.value })} />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn-primary auto">
            {editingId ? 'บันทึกการแก้ไข' : <><PlusIcon size={15} style={{ verticalAlign: -2, marginRight: 4 }} />เพิ่มหมวดหมู่</>}
          </button>
          {editingId && <button type="button" className="btn-outline auto" onClick={cancelEdit}>ยกเลิก</button>}
        </div>
      </form>

      <div className="type-grid">
        {types.map(t => (
          <div key={t.id} className="card type-card">
            <div className="type-card-art" style={{ background: gradientFor(t.type_name) }}>
              <div className="type-card-icon"><BookStackIcon size={18} /></div>
              <h4>{t.type_name}</h4>
            </div>
            <div className="type-card-body">
              <div className="type-card-stats">
                <div className="type-card-stat">
                  <span className="num">{t.book_count}</span>
                  <span className="lbl">เล่มในหมวดนี้</span>
                </div>
                <div className="type-card-stat">
                  <span className="num">{t.borrow_days} วัน</span>
                  <span className="lbl">ยืมได้นานสุด</span>
                </div>
                <div className="type-card-stat">
                  <span className="num">{t.deposit_amount}</span>
                  <span className="lbl">มัดจำ (บาท)</span>
                </div>
              </div>
              <div className="type-card-actions">
                <button type="button" className="btn-outline" onClick={() => startEdit(t)}>
                  <EditIcon size={14} style={{ verticalAlign: -2, marginRight: 4 }} />แก้ไข
                </button>
                <button type="button" className="btn-link danger" title="ลบหมวดหมู่นี้" onClick={() => { setDeleteTarget(t); setDeleteError(''); }}>
                  <TrashIcon size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {types.length === 0 && <p className="muted">ยังไม่มีหมวดหมู่หนังสือ</p>}
      </div>

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>ลบหมวดหมู่ "{deleteTarget.type_name}"?</h3>
            <p className="muted" style={{ marginBottom: 4 }}>การลบนี้ไม่สามารถย้อนกลับได้</p>
            {deleteError && <p className="error-text">{deleteError}</p>}
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button type="button" className="btn-outline" onClick={() => setDeleteTarget(null)}>ยกเลิก</button>
              <button type="button" className="btn-primary" onClick={confirmDelete}>ยืนยันลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
