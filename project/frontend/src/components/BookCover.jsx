import { useEffect, useState } from 'react';
import { gradientFor } from '../utils/coverArt';
import { BookStackIcon } from './Icons';

/**
 * แสดงปกหนังสือ — ถ้ามี cover_image จริงจะแสดงรูปนั้น
 * ถ้าไม่มี หรือโหลดรูปไม่สำเร็จ (เช่น ลิงก์ภายนอกใช้ไม่ได้/ไม่มีอินเทอร์เน็ต)
 * จะสร้างปกแบบ gradient พร้อมชื่อเรื่อง/ผู้แต่งให้อัตโนมัติ (deterministic ตามชื่อหนังสือ)
 */
// การ์ดเล็กไม่ต้องใช้รูป -L (ใหญ่ ~100KB+) ให้ใช้ -M แทนเพื่อให้หน้าแรกโหลดเร็วขึ้น
function coverSrc(url, size) {
  if (size !== 'large' && /covers\.openlibrary\.org\/.*-L\.jpg/.test(url)) return url.replace('-L.jpg', '-M.jpg');
  return url;
}

export default function BookCover({ book, size = 'normal', className = '' }) {
  const sizeClass = size === 'large' ? ' large' : '';
  const [failed, setFailed] = useState(false);

  // เปลี่ยนเล่ม/เปลี่ยนรูป ให้ลองโหลดใหม่
  useEffect(() => { setFailed(false); }, [book?.cover_image]);

  if (book?.cover_image && !failed) {
    return (
      <div className={`book-cover${sizeClass} ${className}`}>
        <img
          src={coverSrc(book.cover_image, size)}
          alt={book.title || ''}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          onLoad={e => {
            // Open Library ส่งรูปว่าง 1x1 กลับมาเมื่อไม่มีปกของ ISBN นั้น → ถือว่าโหลดไม่สำเร็จ
            if (e.currentTarget.naturalWidth <= 1) setFailed(true);
          }}
        />
      </div>
    );
  }

  const title = book?.title || '';
  const author = book?.author || '';

  return (
    <div className={`book-cover${sizeClass} generated ${className}`} style={{ background: gradientFor(title) }}>
      <div className="generated-cover-inner">
        <BookStackIcon size={size === 'large' ? 26 : 16} className="generated-cover-icon" />
        <div className="generated-cover-title">{title}</div>
        {size === 'large' && author && <div className="generated-cover-author">{author}</div>}
      </div>
    </div>
  );
}
