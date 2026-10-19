import { gradientFor } from '../utils/coverArt';
import { BookStackIcon, CheckIcon, CloseIcon } from './Icons';

/**
 * ป็อปอัพเลือกหมวดหมู่หนังสือ — ใช้แทนแถบเลื่อนหมวดหมู่แบบเดิมบนหน้าแรก
 * แสดงเป็นกริดการ์ดสวยๆ พร้อมไอคอน/สีต่อหมวด กดเลือกแล้วปิดป็อปอัพให้อัตโนมัติ
 */
export default function CategoryPickerModal({ open, onClose, types, allCount, countForType, value, onSelect }) {
  if (!open) return null;

  function pick(v) {
    onSelect(v);
    onClose();
  }

  return (
    <div className="modal-backdrop category-modal-backdrop" onClick={onClose}>
      <div className="modal-box category-modal-box" onClick={e => e.stopPropagation()}>
        <div className="category-modal-header">
          <h3>เลือกหมวดหมู่หนังสือ</h3>
          <button type="button" className="category-modal-close" onClick={onClose} aria-label="ปิด">
            <CloseIcon size={18} />
          </button>
        </div>
        <p className="muted" style={{ marginTop: -6, marginBottom: 16 }}>แตะเพื่อกรองหนังสือตามแนวที่สนใจ</p>

        <div className="category-modal-grid">
          <button
            className={`category-modal-card${value === '' ? ' active' : ''}`}
            onClick={() => pick('')}
          >
            <div className="category-modal-art" style={{ background: 'linear-gradient(160deg, #8a94a6, #4d5568)' }}>
              <BookStackIcon size={24} />
              {value === '' && <span className="category-modal-check"><CheckIcon size={13} /></span>}
            </div>
            <div className="category-modal-label">ทั้งหมด</div>
            <div className="category-modal-sub">{allCount} เล่ม</div>
          </button>

          {types.map(t => (
            <button
              key={t.id}
              className={`category-modal-card${value === String(t.id) ? ' active' : ''}`}
              onClick={() => pick(String(t.id))}
            >
              <div className="category-modal-art" style={{ background: gradientFor(t.type_name) }}>
                <BookStackIcon size={24} />
                {value === String(t.id) && <span className="category-modal-check"><CheckIcon size={13} /></span>}
              </div>
              <div className="category-modal-label">{t.type_name}</div>
              <div className="category-modal-sub">{countForType(t.id)} เล่ม · ยืม {t.borrow_days} วัน</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
