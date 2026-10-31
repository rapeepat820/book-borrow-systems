import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// ตรวจเลขบัตรประชาชนไทย 13 หลัก (รูปแบบ + เลขหลักตรวจสอบ) — ตรวจเหมือนฝั่งเซิร์ฟเวอร์
export function validateThaiId(id) {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

export const EMPTY_IDENTITY = { id_number: '', id_card: null, selfie: null, consent: false };

function formatId(d) {
  const x = d.replace(/\D/g, '').slice(0, 13);
  const parts = [x.slice(0, 1), x.slice(1, 5), x.slice(5, 10), x.slice(10, 12), x.slice(12, 13)].filter(Boolean);
  return parts.join('-');
}

// ใส่ข้อมูลยืนยันตัวตนลง FormData (ใช้ร่วมกันทั้งหน้าสมัครและหน้ายืนยันตัวตน)
export function appendIdentity(fd, v) {
  fd.append('id_number', v.id_number.replace(/\D/g, ''));
  fd.append('consent', v.consent ? 'true' : 'false');
  if (v.id_card) fd.append('id_card_image', v.id_card);
  if (v.selfie) fd.append('selfie_image', v.selfie);
}

export function identityError(v) {
  const id = v.id_number.replace(/\D/g, '');
  if (!validateThaiId(id)) return 'เลขบัตรประชาชนไม่ถูกต้อง (ต้องมี 13 หลักและผ่านการตรวจเลขท้าย)';
  if (!v.id_card) return 'กรุณาแนบรูปถ่ายบัตรประชาชน';
  if (!v.selfie) return 'กรุณาแนบรูปเซลฟี่ถือบัตรประชาชนของคุณ';
  if (!v.consent) return 'กรุณายินยอมให้เก็บและใช้ข้อมูลเพื่อยืนยันตัวตน';
  return '';
}

function PhotoPicker({ label, hint, file, onPick }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file) { setUrl(''); return undefined; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div style={{ marginTop: 10 }}>
      <label>{label}<span className="required-mark">*</span></label>
      <p className="muted" style={{ margin: '0 0 6px', fontSize: 12.5 }}>{hint}</p>
      {url && <img src={url} alt={label} style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 6 }} />}
      <input type="file" accept="image/*" onChange={e => onPick(e.target.files[0] || null)} />
    </div>
  );
}

export default function IdentityFields({ value, onChange, compact = false }) {
  const id = value.id_number.replace(/\D/g, '');
  return (
    <div className="card" style={{ marginTop: 16 }}>
      {!compact && <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>ยืนยันตัวตน</h3>}
      <p className="muted" style={{ margin: '0 0 8px', fontSize: 12.5 }}>
        เจ้าหน้าที่จะตรวจสอบข้อมูลนี้ก่อนอนุมัติให้ยืมหนังสือ รูปบัตรและเลขบัตรเต็มจะถูกลบออกจากระบบทันทีหลังตรวจเสร็จ
      </p>

      <label>เลขบัตรประชาชน 13 หลัก<span className="required-mark">*</span></label>
      <input inputMode="numeric" placeholder="x-xxxx-xxxxx-xx-x" value={formatId(value.id_number)}
        onChange={e => onChange({ id_number: e.target.value })} />
      {id.length === 13 && !validateThaiId(id) && <p className="error-text" style={{ margin: '4px 0 0' }}>เลขบัตรไม่ถูกต้อง กรุณาตรวจอีกครั้ง</p>}

      <PhotoPicker label="รูปถ่ายบัตรประชาชน (ด้านหน้า)"
        hint="ถ่ายให้เห็นชื่อ-นามสกุลและเลขบัตรชัดเจน ไม่เบลอ ไม่สะท้อนแสง (ปิดบังศาสนาและหมู่เลือดได้ เราไม่ต้องใช้)"
        file={value.id_card} onPick={f => onChange({ id_card: f })} />
      <PhotoPicker label="รูปเซลฟี่ถือบัตรประชาชน"
        hint="ถ่ายให้เห็นใบหน้าและบัตรในรูปเดียวกัน ใช้บัตรใบเดียวกับที่แนบด้านบน"
        file={value.selfie} onPick={f => onChange({ selfie: f })} />

      <label className="checkbox-row" style={{ margin: '14px 0 0' }}>
        <input type="checkbox" checked={value.consent} onChange={e => onChange({ consent: e.target.checked })} />
        <span>ฉันยินยอมให้ร้านเก็บและใช้เลขบัตร รูปบัตร และรูปเซลฟี่ เพื่อยืนยันตัวตนก่อนยืมหนังสือเท่านั้น
          ตาม<Link to="/privacy" className="btn-link"> นโยบายความเป็นส่วนตัว</Link></span>
      </label>
    </div>
  );
}
