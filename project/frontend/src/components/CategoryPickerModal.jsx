import { paletteFor } from '../utils/coverArt';
import { BookStackIcon, CheckIcon, CloseIcon } from './Icons';

/**
 * ป็อปอัพเลือกหมวดหมู่หนังสือ — รายการแนวตั้งที่เรียบ อ่านง่าย (ไอคอนสีเล็ก + ชื่อ + จำนวนเล่ม)
 * บนมือถือเป็นแผงเลื่อนขึ้นจากด้านล่าง กดเลือกแล้วปิดให้อัตโนมัติ
 */
function Row({ active, color, title, sub, onClick }) {
  return (
    <button type="button" role="radio" aria-checked={active} className={`category-option${active ? ' active' : ''}`} onClick={onClick}>
      <span className="category-option-icon" style={{ background: color }}><BookStackIcon size={18} /></span>
      <span className="category-option-text">
        <span className="category-option-title">{title}</span>
        <span className="category-option-sub">{sub}</span>
      </span>
      <span className="category-option-mark">{active && <CheckIcon size={14} />}</span>
    </button>
  );
}

export default function CategoryPickerModal({ open, onClose, types, allCount, countForType, value, onSelect }) {
  if (!open) return null;

  function pick(v) {
    onSelect(v);
    onClose();
  }

  return (
    <div className="modal-backdrop category-modal-backdrop" onClick={onClose}>
      <div className="modal-box category-modal-box" role="dialog" aria-label="เลือกหมวดหมู่หนังสือ" onClick={e => e.stopPropagation()}>
        <div className="category-modal-header">
          <div>
            <h3>หมวดหมู่หนังสือ</h3>
            <p className="category-modal-hint">เลือกแนวที่สนใจเพื่อกรองรายการ</p>
          </div>
          <button type="button" className="category-modal-close" onClick={onClose} aria-label="ปิด">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="category-options" role="radiogroup">
          <Row active={value === ''} color="linear-gradient(160deg, #8a94a6, #4d5568)" title="ทั้งหมด" sub={`${allCount} เล่ม`} onClick={() => pick('')} />
          {types.map(t => {
            const [c1, c2] = paletteFor(t.type_name);
            return (
              <Row
                key={t.id}
                active={value === String(t.id)}
                color={`linear-gradient(160deg, ${c1}, ${c2})`}
                title={t.type_name}
                sub={`${countForType(t.id)} เล่ม · ยืมได้ ${t.borrow_days} วัน`}
                onClick={() => pick(String(t.id))}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
