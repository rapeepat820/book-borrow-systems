import { Link } from 'react-router-dom';
import BookCover from './BookCover';
import FavButton from './FavButton';

export default function BookCard({ book, showAvailability = true }) {
  const available = book.available_copies > 0;
  // ค่าหนังสือ (มูลค่า) และค่ามัดจำที่ต้องวาง = มากกว่าระหว่างมัดจำตามประเภทหนังสือกับมูลค่าหนังสือ (ตรงกับที่ระบบเรียกเก็บจริง)
  const value = Number(book.price_value || 0);
  const deposit = Math.max(Number(book.type_deposit || 0), value);
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
