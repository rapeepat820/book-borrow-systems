import useFavorites from '../hooks/useFavorites';
import { HeartIcon } from './Icons';

// ปุ่มหัวใจกดบันทึก/ยกเลิกรายการโปรด — ใช้ซ้อนบนปกหนังสือหรือวางเดี่ยวๆ ได้
export default function FavButton({ bookId, className = '' }) {
  const { isFav, toggle } = useFavorites();
  const active = isFav(bookId);
  return (
    <button
      type="button"
      className={`fav-btn${active ? ' active' : ''} ${className}`}
      aria-pressed={active}
      aria-label={active ? 'เอาออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(bookId); }}
    >
      <HeartIcon size={17} />
    </button>
  );
}
