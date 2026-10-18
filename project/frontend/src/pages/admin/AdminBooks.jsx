import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { CameraIcon } from '../../components/Icons';

const EMPTY = {
  title: '', author: '', cover_image: '', description: '', book_type_id: '', total_copies: 1, price_value: 0,
  publisher: '', publish_year: '', edition: '', volume: '', print_no: ''
};

export default function AdminBooks() {
  const [books, setBooks] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupMsg, setLookupMsg] = useState('');
  const [autoFill, setAutoFill] = useState(null);
  const fileInputRef = useRef(null);

  function load() {
    api.adminGetBooks().then(setBooks);
    api.adminGetBookTypes().then(setTypes);
  }
  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (editingId) await api.adminUpdateBook(editingId, form);
    else await api.adminCreateBook(form);
    resetForm();
    load();
  }

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
    setCoverPreview('');
    setCoverError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function startEdit(b) {
    setEditingId(b.id);
    setForm({
      title: b.title, author: b.author, cover_image: b.cover_image || '',
      description: b.description || '', book_type_id: b.book_type_id,
      total_copies: b.total_copies, price_value: b.price_value,
      publisher: b.publisher || '', publish_year: b.publish_year || '',
      edition: b.edition || '', volume: b.volume || '', print_no: b.print_no || ''
    });
    setCoverPreview(b.cover_image || '');
    setCoverError('');
  }

  async function handleDelete(id) {
    if (!confirm('ยืนยันการลบหนังสือเล่มนี้?')) return;
    await api.adminDeleteBook(id);
    load();
  }

  // เติมรูปปก/ปีที่พิมพ์/ฉบับที่/เล่มที่ ให้หนังสือทุกเล่มที่ยังว่าง แล้วคอยถามความคืบหน้าจนเสร็จ
  async function handleAutoFill() {
    try {
      setAutoFill({ running: true, step: 'กำลังเริ่ม...' });
      await api.adminAutoFillBooks();
      const timer = setInterval(async () => {
        try {
          const st = await api.adminAutoFillStatus();
          setAutoFill(st);
          if (!st.running) { clearInterval(timer); load(); }
        } catch { clearInterval(timer); setAutoFill({ running: false, message: 'ตรวจสถานะไม่สำเร็จ' }); }
      }, 2000);
    } catch (err) {
      setAutoFill({ running: false, message: err.message || 'เริ่มไม่สำเร็จ' });
    }
  }

  // ดึงปก/ผู้แต่ง/สำนักพิมพ์/ปี/เรื่องย่อ จาก Open Library + Google Books มาเติมช่องที่ยังว่างในฟอร์ม
  async function handleLookup() {
    if (!form.title.trim()) { setLookupMsg('กรุณาใส่ชื่อหนังสือก่อน'); return; }
    setLookingUp(true);
    setLookupMsg('');
    try {
      const info = await api.adminLookupBook({ title: form.title, author: form.author || '' });
      setForm(f => ({
        ...f,
        author: f.author || info.author || '',
        cover_image: f.cover_image || info.cover_image || '',
        description: f.description || info.description || '',
        publisher: f.publisher || info.publisher || '',
        publish_year: f.publish_year || info.publish_year || ''
      }));
      if (!form.cover_image && info.cover_image) setCoverPreview(info.cover_image);
      setLookupMsg(`ดึงข้อมูลจาก ${info.source} แล้ว (เติมเฉพาะช่องที่ว่าง) — ตรวจความถูกต้องก่อนกดบันทึก`);
    } catch (err) {
      setLookupMsg(err.message || 'ดึงข้อมูลไม่สำเร็จ');
    } finally {
      setLookingUp(false);
    }
  }

  async function handleCoverFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCoverError('');
    setCoverPreview(URL.createObjectURL(file)); // แสดงตัวอย่างทันทีระหว่างอัปโหลด
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('cover_image', file);
      const result = await api.adminUploadBookCover(formData);
      setForm(f => ({ ...f, cover_image: result.cover_image }));
    } catch (err) {
      setCoverError(err.message || 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploadingCover(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>เติมรูปปกและรายละเอียดอัตโนมัติ</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          เติมรูปปก ปีที่พิมพ์ ฉบับที่ เล่มที่ ให้หนังสือทุกเล่มที่ยังว่าง (ไม่เขียนทับข้อมูลที่คุณใส่ไว้) เล่มที่ไม่มีในระบบจะไปค้นจากอินเทอร์เน็ตให้
        </p>
        <button type="button" className="btn-primary" disabled={autoFill?.running} onClick={handleAutoFill}>
          {autoFill?.running ? 'กำลังทำงาน...' : 'เติมข้อมูลหนังสือทั้งหมดอัตโนมัติ'}
        </button>
        {autoFill?.running && (
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
            {autoFill.step}{autoFill.total ? ` (${autoFill.done}/${autoFill.total} เล่ม)` : ''}
          </p>
        )}
        {!autoFill?.running && autoFill?.message && <p style={{ fontSize: 13, marginBottom: 0 }}>{autoFill.message}</p>}
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h3>{editingId ? 'แก้ไขหนังสือ' : 'เพิ่มหนังสือใหม่'}</h3>
        <button type="button" className="btn-link" disabled={lookingUp} onClick={handleLookup} style={{ marginBottom: 10 }}>
          {lookingUp ? 'กำลังค้นหา...' : 'ดึงปกและรายละเอียดจากอินเทอร์เน็ตตามชื่อหนังสือ'}
        </button>
        {lookupMsg && <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{lookupMsg}</p>}
        <div className="form-row">
          <div>
            <label>ชื่อหนังสือ</label>
            <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label>ผู้แต่ง</label>
            <input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div>
            <label>ประเภทหนังสือ</label>
            <select required value={form.book_type_id} onChange={e => setForm({ ...form, book_type_id: e.target.value })}>
              <option value="">เลือกประเภท</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.type_name}</option>)}
            </select>
          </div>
          <div>
            <label>จำนวนเล่มทั้งหมด</label>
            <input type="number" min="1" value={form.total_copies} onChange={e => setForm({ ...form, total_copies: e.target.value })} />
          </div>
          <div>
            <label>มูลค่าหนังสือ (บาท)</label>
            <input type="number" min="0" value={form.price_value} onChange={e => setForm({ ...form, price_value: e.target.value })} />
          </div>
        </div>
        <label>รูปปกหนังสือ</label>
        <label className="card" style={{
          display: 'flex', flexDirection: coverPreview ? 'row' : 'column', alignItems: 'center',
          justifyContent: 'center', gap: 12, cursor: 'pointer', padding: coverPreview ? 12 : 26,
          border: '1.5px dashed var(--border)', marginBottom: 16
        }}>
          {coverPreview ? (
            <>
              <img src={coverPreview} alt="" style={{ width: 74, height: 100, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
              <span className="muted" style={{ fontSize: 13 }}>
                {uploadingCover ? 'กำลังอัปโหลด...' : 'แตะเพื่อเปลี่ยนรูปปก (ถ่ายรูปหรือเลือกไฟล์)'}
              </span>
            </>
          ) : (
            <>
              <CameraIcon size={26} />
              <span className="muted">แตะเพื่อถ่ายรูปหรือเลือกรูปปกหนังสือ (jpg, png, webp)</span>
            </>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleCoverFile} style={{ display: 'none' }} />
        </label>
        {coverError && <p className="error-text" style={{ marginTop: -10, marginBottom: 14 }}>{coverError}</p>}

        <div className="form-row">
          <div>
            <label>สำนักพิมพ์</label>
            <input value={form.publisher} onChange={e => setForm({ ...form, publisher: e.target.value })} />
          </div>
          <div>
            <label>ปีที่พิมพ์ (ค.ศ.)</label>
            <input type="number" value={form.publish_year} onChange={e => setForm({ ...form, publish_year: e.target.value })} />
          </div>
          <div>
            <label>ตีพิมพ์ครั้งที่</label>
            <input type="number" min="1" value={form.print_no} onChange={e => setForm({ ...form, print_no: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div>
            <label>ฉบับที่</label>
            <input placeholder="เช่น ฉบับที่ 2, ฉบับพิมพ์ครั้งแรก, ฉบับปรับปรุง" value={form.edition} onChange={e => setForm({ ...form, edition: e.target.value })} />
          </div>
          <div>
            <label>เล่มที่</label>
            <input placeholder="เช่น เล่ม 1, เล่มเดียวจบ" value={form.volume} onChange={e => setForm({ ...form, volume: e.target.value })} />
          </div>
        </div>

        <label>คำอธิบาย</label>
        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <button className="btn-primary">{editingId ? 'บันทึกการแก้ไข' : 'เพิ่มหนังสือ'}</button>
        {editingId && <button type="button" className="btn-link" onClick={resetForm}>ยกเลิก</button>}
      </form>

      <table className="data-table">
        <thead><tr><th></th><th>ชื่อหนังสือ</th><th>ประเภท</th><th>ปีที่พิมพ์</th><th>ฉบับที่</th><th>เล่มที่</th><th>คงเหลือ/ทั้งหมด</th><th>มูลค่า</th><th></th></tr></thead>
        <tbody>
          {books.map(b => (
            <tr key={b.id}>
              <td className="thumb-cell">
                {b.cover_image
                  ? <img className="admin-thumb" src={b.cover_image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                  : <div className="admin-thumb empty">ไม่มีปก</div>}
              </td>
              <td>{b.title}{b.author ? <div className="muted" style={{ fontSize: 12 }}>{b.author}</div> : null}</td>
              <td>{b.type_name}</td>
              <td>{b.publish_year || '-'}</td>
              <td>{b.edition || '-'}</td>
              <td>{b.volume || '-'}</td>
              <td>{b.available_copies}/{b.total_copies}</td>
              <td>{b.price_value} บาท</td>
              <td>
                <button className="btn-link" onClick={() => startEdit(b)}>แก้ไข</button>
                <button className="btn-link danger" onClick={() => handleDelete(b.id)}>ลบ</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
