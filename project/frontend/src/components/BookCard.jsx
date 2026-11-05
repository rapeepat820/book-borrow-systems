import { Link } from 'react-router-dom';
import BookCover from './BookCover';
import FavButton from './FavButton';

export default function BookCard({ book, showAvailability = true }) {
  const available = book.available_copies > 0;
  // มูลค่าหนังสือ และค่ามัดจำจริงที่ระบบเรียกเก็บ (20% ของมูลค่า คำนวณจากเซิร์ฟเวอร์ให้ตรงกันทุกหน้า)
  const value = Number(book.price_value || 0);
  const deposit = Number(book.deposit_amount ?? book.type_deposit ?? 0);
  return (
    <Link to={`/books/${book.id}`} className="book-card">
      <FavButton bookId={book.id} />
      <BookCover book={book} />
      <h3>{book.title}</h3>
      <p className="muted">{book.author}</p>
      <p className="book-meta">
        <span>ปี {book.publish_year || 'ไม่ระบุ'}</span>
        <span>{book.volume || 'เล่มไม่ระบุ'}</span>
      </p>
      <p className="book-meta edition">{book.edition || 'ฉบับไม่ระบุ'}</p>
      <p className="book-meta book-price">
        <span>มูลค่า {value.toLocaleString('th-TH')} ฿</span>
        <span>มัดจำ {deposit.toLocaleString('th-TH')} ฿</span>
      </p>
      {showAvailability && (
        <span className={`book-avail${available ? '' : ' out'}`}>
          {available ? `เหลือ ${book.available_copies} เล่ม` : 'ยืมหมดแล้ว'}
        </span>
      )}
    </Link>
  );
}
