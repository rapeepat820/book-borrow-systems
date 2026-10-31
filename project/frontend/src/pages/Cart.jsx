import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getCart, removeFromCart, clearCart, MAX_CART_ITEMS } from '../cart';
import BookCover from '../components/BookCover';
import { ChevronLeftIcon, TruckIcon, TrashIcon, CartIcon } from '../components/Icons';

export default function Cart() {
  const navigate = useNavigate();
  const [ids, setIds] = useState(getCart());
  const [books, setBooks] = useState({});
  const [companies, setCompanies] = useState([]);
  const [shippingId, setShippingId] = useState('');
  const [me, setMe] = useState(null);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getShippingCompanies().then(list => { setCompanies(list); if (list.length) setShippingId(list[0].id); });
    api.getMe().then(setMe);
  }, []);

  // โหลดข้อมูลหนังสือในตะกร้า (ตัดเล่มที่ไม่มีแล้วออกเงียบๆ)
  useEffect(() => {
    let alive = true;
    Promise.all(ids.map(id => api.getBook(id).catch(() => null))).then(rows => {
      if (!alive) return;
      const map = {};
      rows.forEach(b => { if (b) map[b.id] = b; });
      setBooks(map);
      const valid = ids.filter(id => map[id]);
      if (valid.length !== ids.length) { ids.filter(id => !map[id]).forEach(removeFromCart); setIds(valid); }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  useEffect(() => {
    setQuote(null);
    if (!ids.length || !shippingId) return;
    api.getQuoteMany(ids, shippingId).then(q => { setQuote(q); setError(''); }).catch(e => setError(e.message));
  }, [ids.join(','), shippingId]);

  function remove(id) { removeFromCart(id); setIds(getCart()); }

  async function handleCheckout() {
    if (!me?.address) return setError('กรุณาตั้งค่าที่อยู่สำหรับจัดส่งหนังสือในหน้าโปรไฟล์ก่อนยืม');
    setError('');
    setSubmitting(true);
    try {
      const result = await api.createBorrow({ book_ids: ids, shipping_company_id: Number(shippingId), shipping_address: me.address });
      clearCart();
      navigate(`/borrow/${result.id}/payment`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const soldOut = ids.filter(id => books[id] && books[id].available_copies < 1);

  return (
    <div>
      <div className="book-detail-header">
        <Link to="/" className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">ตะกร้าหนังสือ</span>
      </div>

      {ids.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <CartIcon size={34} />
          <p className="muted">ตะกร้ายังว่างอยู่ เลือกหนังสือแล้วกด "เพิ่มลงตะกร้า" เพื่อยืมหลายเล่มพร้อมกัน (สูงสุด {MAX_CART_ITEMS} เล่มต่อออเดอร์)</p>
          <Link to="/" className="btn-primary auto">เลือกหนังสือ</Link>
        </div>
      ) : (
        <>
          <p className="muted">ยืมพร้อมกันได้สูงสุด {MAX_CART_ITEMS} เล่ม ชำระเงินและจัดส่งรวมเป็นพัสดุเดียว ค่าส่งคิดตามน้ำหนักจริงของพัสดุ</p>
          <div className="record-list">
            {ids.map(id => books[id] && (
              <div key={id} className="card summary-card" style={{ alignItems: 'center' }}>
                <BookCover book={books[id]} />
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 3px', fontSize: 15 }}>{books[id].title}</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    {books[id].type_name} · ยืมได้ {books[id].borrow_days} วัน · {books[id].weight_g ?? 300} ก.
                  </p>
                  {books[id].available_copies < 1 && <p style={{ margin: '4px 0 0', color: 'var(--danger)', fontSize: 13 }}>เล่มนี้ถูกยืมหมดแล้ว — นำออกจากตะกร้าเพื่อดำเนินการต่อ (หรือจองคิวที่หน้าหนังสือ)</p>}
                </div>
                <button className="btn-link danger" onClick={() => remove(id)} aria-label="นำออก"><TrashIcon size={18} /></button>
              </div>
            ))}
          </div>

          <label><TruckIcon size={15} style={{ verticalAlign: -3, marginRight: 4 }} />จัดส่งโดย</label>
          {companies.length > 1 ? (
            <select value={shippingId} onChange={e => setShippingId(e.target.value)}>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name} (ส่งถึง ~{c.delivery_days} วัน)</option>)}
            </select>
          ) : companies[0] ? (
            <div className="card" style={{ padding: 14 }}>
              <b>{companies[0].name}</b>
              <div className="muted" style={{ fontSize: 12.5 }}>ระยะเวลาจัดส่งโดยประมาณ {companies[0].delivery_days} วัน</div>
            </div>
          ) : <p className="muted">ยังไม่มีบริษัทขนส่งที่เปิดใช้งาน</p>}

          <label>ที่อยู่สำหรับจัดส่ง</label>
          {me?.address ? (
            <div className="card" style={{ padding: 14 }}>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.7 }}>{me.address}</p>
              <Link to="/menu/edit-profile" className="btn-link" style={{ display: 'inline-block', marginTop: 8 }}>แก้ไขที่อยู่</Link>
            </div>
          ) : (
            <div className="warning-box"><span>คุณยังไม่มีที่อยู่ในโปรไฟล์ กรุณา <Link to="/menu/edit-profile" className="btn-link">เพิ่มที่อยู่</Link> ก่อนยืมหนังสือ</span></div>
          )}

          {quote && (
            <div className="quote-box">
              <p>จำนวน <b>{quote.item_count}</b> เล่ม · น้ำหนักพัสดุรวม <b>{quote.total_weight_g.toLocaleString()} กรัม</b> <span className="muted">(รวมบรรจุภัณฑ์ {quote.packaging_weight_g} ก.)</span></p>
              <p>แพ็กใส่ <b>{quote.box_name}</b></p>
              <p>ค่าจัดส่งรวม: <b>{quote.shipping_fee} บาท</b> <span className="muted">({quote.rate_source === 'flash' ? 'ราคาจากขนส่งโดยตรง' : quote.rate_source === 'manual_fallback' ? 'ราคาประมาณการ' : 'ตามตารางราคา'})</span></p>
              {quote.rate_note && <p className="muted" style={{ fontSize: 12.5 }}>{quote.rate_note}</p>}
              <p>ค่ามัดจำรวม (คืนเมื่อคืนหนังสือสภาพดี): <b>{quote.deposit_amount} บาท</b></p>
              {quote.items.map(it => (
                <p key={it.book_id} className="muted" style={{ fontSize: 13, margin: '2px 0' }}>
                  • {it.title} — มัดจำ {it.deposit_amount} บาท · กำหนดคืน {String(it.due_date).slice(0, 10)}
                </p>
              ))}
              <hr />
              <p>ยอดชำระตอนนี้ (ค่าส่ง + มัดจำ): <b>{quote.total_pay} บาท</b></p>
            </div>
          )}

          {error && <p className="error-text">{error}{/ยืนยันตัวตน/.test(error) && <> <Link to="/verify-identity" className="btn-link">ไปยืนยันตัวตน</Link></>}</p>}
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={handleCheckout}
            disabled={!quote || !me?.address || submitting || soldOut.length > 0}>
            {submitting ? 'กำลังสร้างรายการ...' : 'ถัดไป: ชำระเงิน →'}
          </button>
          <button className="btn-link danger" style={{ marginTop: 10 }} onClick={() => { clearCart(); setIds([]); }}>ล้างตะกร้า</button>
        </>
      )}
    </div>
  );
}
