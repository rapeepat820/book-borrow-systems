import { Link } from 'react-router-dom';
import BookCover from './BookCover';
import FavButton from './FavButton';

export default function BookCard({ book, showAvailability = true }) {
  const available = book.available_copies > 0;
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
      {showAvailability && (
        <span className={`book-avail${available ? '' : ' out'}`}>
          {available ? `เหลือ ${book.available_copies} เล่ม` : 'ยืมหมดแล้ว'}
        </span>
      )}
    </Link>
  );
}
