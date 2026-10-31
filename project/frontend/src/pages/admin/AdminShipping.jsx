import { useEffect, useState } from 'react';
import { api } from '../../api';

const EMPTY = { name: '', base_fee: 0, fee_per_book: 0, base_weight_g: 1000, fee_per_extra_kg: 0, rate_provider: 'manual', markup_percent: 0, delivery_days: 1, tracking_url: '', is_active: 0 };

function CompaniesSection() {
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
        — สูตรคำนวณ: ค่าจัดส่ง = ค่าเริ่มต้น (ครอบคลุมน้ำหนักถึงที่กำหนด) + ค่าเพิ่มต่อทุก 1 กก. ที่เกิน (ปัดขึ้น) โดยน้ำหนักพัสดุ = น้ำหนักหนังสือทุกเล่มในออเดอร์ + บรรจุภัณฑ์ (ค่าเริ่มต้น 100 ก.) และจำนวนวันจัดส่งจะถูกนำไปบวกในระยะเวลายืม-คืน
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
            <label>น้ำหนักที่ค่าเริ่มต้นครอบคลุม (กรัม)</label>
            <input type="number" min="1" value={form.base_weight_g} onChange={e => setForm({ ...form, base_weight_g: e.target.value })} />
          </div>
          <div>
            <label>ค่าจัดส่งเพิ่มต่อทุก 1 กก. ที่เกิน (บาท)</label>
            <input type="number" min="0" value={form.fee_per_extra_kg} onChange={e => setForm({ ...form, fee_per_extra_kg: e.target.value })} />
          </div>
          <div>
            <label>วิธีหาค่าส่ง</label>
            <select value={form.rate_provider || 'manual'} onChange={e => setForm({ ...form, rate_provider: e.target.value })}>
              <option value="manual">ตารางราคาของร้าน (ค่าเริ่มต้น + ต่อ กก.)</option>
              <option value="flash">ขอราคาจริงจาก Flash Express (API)</option>
            </select>
          </div>
          {form.rate_provider === 'flash' && (
            <div>
              <label>บวกเพิ่มจากราคา API (%)</label>
              <input type="number" min="0" max="100" step="0.5" value={form.markup_percent ?? 0} onChange={e => setForm({ ...form, markup_percent: e.target.value })} />
            </div>
          )}
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
        <thead><tr><th>บริษัท</th><th>วิธีหาค่าส่ง</th><th>ตารางราคา (เริ่มต้น / เพิ่มต่อ กก.)</th><th>วันจัดส่ง</th><th>สถานะ</th><th></th></tr></thead>
        <tbody>
          {companies.map(c => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.rate_provider === 'flash' ? <span className="pill pill-blue">Flash API{Number(c.markup_percent) ? ` +${c.markup_percent}%` : ''}</span> : <span className="pill pill-gray">ตารางร้าน</span>}</td>
              <td>{c.base_fee} บาท <span className="muted">(≤ {c.base_weight_g ?? 1000} ก.)</span> / {c.fee_per_extra_kg ?? 0} บาท</td>
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


// ---------- กล่องจัดส่ง + รหัสไปรษณีย์ต้นทาง + ทดลองคำนวณ ----------
const EMPTY_BOX = { name: '', max_items: 2, max_book_weight_g: 1200, length_cm: 25, width_cm: 18, height_cm: 8, packaging_weight_g: 120, sort_order: 0, is_active: 1 };

function BoxesSection() {
  const [boxes, setBoxes] = useState([]);
  const [form, setForm] = useState(EMPTY_BOX);
  const [editingId, setEditingId] = useState(null);
  const [settings, setSettings] = useState(null);
  const [postal, setPostal] = useState('');
  const [msg, setMsg] = useState('');
  const [companies, setCompanies] = useState([]);
  const [test, setTest] = useState({ company_id: '', postal: '', items: 1 });
  const [testResult, setTestResult] = useState('');

  function load() {
    api.adminGetShippingBoxes().then(setBoxes).catch(e => setMsg(e.message));
    api.adminGetShippingSettings().then(s => { setSettings(s); setPostal(s.ship_from_postal || ''); });
    api.adminGetShipping().then(list => { setCompanies(list); setTest(t => ({ ...t, company_id: t.company_id || (list.find(c => c.is_active) || list[0] || {}).id || '' })); });
  }
  useEffect(load, []);

  async function saveBox(e) {
    e.preventDefault(); setMsg('');
    try { await api.adminSaveShippingBox(editingId, form); setForm(EMPTY_BOX); setEditingId(null); load(); } catch (err) { setMsg(err.message); }
  }
  async function removeBox(id) {
    if (!confirm('ลบกล่องนี้?')) return;
    await api.adminDeleteShippingBox(id); load();
  }
  async function savePostal() {
    setMsg('');
    try { const r = await api.adminSaveShippingSettings({ ship_from_postal: postal }); setMsg(r.message); load(); } catch (err) { setMsg(err.message); }
  }
  async function runTest() {
    setTestResult('กำลังคำนวณ...');
    try {
      const r = await api.adminShippingTest(test.company_id, test.postal, test.items);
      setTestResult(`${r.books} เล่ม → ${r.box} (น้ำหนักพัสดุ ${r.parcel_weight_g} ก.) ค่าส่ง ${r.fee} บาท · แหล่งราคา: ${r.source === 'flash' ? 'Flash API' : r.source === 'manual_fallback' ? 'ตารางร้าน (API ใช้ไม่ได้)' : 'ตารางร้าน'}${r.note ? ` — ${r.note}` : ''}`);
    } catch (err) { setTestResult(err.message); }
  }

  const num = key => ({ type: 'number', min: 0, value: form[key], onChange: e => setForm({ ...form, [key]: e.target.value }) });

  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18 }}>กล่องจัดส่งและการขอราคาจริง</h2>
      <p className="muted">
        ระบบเลือก "กล่องเล็กที่สุดที่ใส่หนังสือทั้งออเดอร์ได้" ตามจำนวนเล่มและน้ำหนัก แล้วใช้ขนาดกล่องนั้นขอราคาจากขนส่ง
        {settings && (settings.flash_configured
          ? ' — เชื่อมต่อ API Flash Express แล้ว'
          : ' — ยังไม่ได้ตั้งค่า API Flash (ต้องมี FLASH_MCH_ID และ FLASH_SECRET_KEY ใน Railway) ระบบจะใช้ตารางราคาของร้านแทน')}
      </p>
      {msg && <p className="pill pill-blue" style={{ display: 'block', padding: 10 }}>{msg}</p>}

      <div className="card">
        <label>รหัสไปรษณีย์ต้นทาง (ที่ตั้งร้านที่ส่งพัสดุ) 5 หลัก</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input inputMode="numeric" maxLength={5} placeholder="เช่น 70000" value={postal} onChange={e => setPostal(e.target.value.replace(/\D/g, ''))} />
          <button className="btn-primary auto" onClick={savePostal}>บันทึก</button>
        </div>
      </div>

      <form className="card" onSubmit={saveBox}>
        <h3>{editingId ? 'แก้ไขกล่อง' : 'เพิ่มกล่อง'}</h3>
        <div className="form-row">
          <div><label>ชื่อกล่อง</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label>ใส่หนังสือได้ (เล่ม)</label><input {...num('max_items')} /></div>
          <div><label>น้ำหนักหนังสือสูงสุด (กรัม)</label><input {...num('max_book_weight_g')} /></div>
          <div><label>ยาว (ซม.)</label><input {...num('length_cm')} /></div>
          <div><label>กว้าง (ซม.)</label><input {...num('width_cm')} /></div>
          <div><label>สูง (ซม.)</label><input {...num('height_cm')} /></div>
          <div><label>น้ำหนักกล่อง+กันกระแทก (กรัม)</label><input {...num('packaging_weight_g')} /></div>
          <div><label>ลำดับ (เล็ก→ใหญ่)</label><input {...num('sort_order')} /></div>
        </div>
        <button className="btn-primary" style={{ marginTop: 12 }}>{editingId ? 'บันทึก' : 'เพิ่มกล่อง'}</button>
        {editingId && <button type="button" className="btn-link" onClick={() => { setEditingId(null); setForm(EMPTY_BOX); }}>ยกเลิก</button>}
      </form>

      <table className="data-table">
        <thead><tr><th>กล่อง</th><th>รับได้</th><th>ขนาด (ซม.)</th><th>น้ำหนักตัวกล่อง</th><th></th></tr></thead>
        <tbody>
          {boxes.map(b => (
            <tr key={b.id}>
              <td>{b.name}</td>
              <td>{b.max_items} เล่ม / {b.max_book_weight_g} ก.</td>
              <td>{b.length_cm}×{b.width_cm}×{b.height_cm}</td>
              <td>{b.packaging_weight_g} ก.</td>
              <td style={{ display: 'flex', gap: 14 }}>
                <button className="btn-link" onClick={() => { setEditingId(b.id); setForm(b); }}>แก้ไข</button>
                <button className="btn-link danger" onClick={() => removeBox(b.id)}>ลบ</button>
              </td>
            </tr>
          ))}
          {boxes.length === 0 && <tr><td colSpan={5} className="muted">ยังไม่มีกล่อง (ระบบจะใช้กล่องมาตรฐานเดียว)</td></tr>}
        </tbody>
      </table>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>ทดลองคำนวณค่าส่ง</h3>
        <p className="muted" style={{ marginTop: 0 }}>ใช้ตรวจว่าตั้งค่า API ถูกต้องก่อนเปิดให้ลูกค้าใช้ (สุ่มหนังสือตามจำนวนเล่มที่เลือก)</p>
        <div className="form-row">
          <div><label>ขนส่ง</label>
            <select value={test.company_id} onChange={e => setTest({ ...test, company_id: e.target.value })}>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label>รหัสไปรษณีย์ปลายทาง</label><input inputMode="numeric" maxLength={5} placeholder="เช่น 10110" value={test.postal} onChange={e => setTest({ ...test, postal: e.target.value.replace(/\D/g, '') })} /></div>
          <div><label>จำนวนเล่ม (1-5)</label><input type="number" min="1" max="5" value={test.items} onChange={e => setTest({ ...test, items: e.target.value })} /></div>
        </div>
        <button className="btn-secondary auto" style={{ marginTop: 10 }} onClick={runTest}>คำนวณ</button>
        {testResult && <p style={{ margin: '10px 0 0' }}>{testResult}</p>}
      </div>
    </div>
  );
}

export default function AdminShipping() {
  return (
    <div>
      <CompaniesSection />
      <BoxesSection />
    </div>
  );
}
