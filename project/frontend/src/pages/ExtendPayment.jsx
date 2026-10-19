import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { api } from '../api';
import BookCover from '../components/BookCover';
import { PROMPTPAY_QR_IMAGE, PROMPTPAY_ACCOUNT_NAME } from '../config/payment';
import { ChevronLeftIcon, CameraIcon, AlertIcon } from '../components/Icons';

export default function ExtendPayment() {
  const { id } = useParams(); // borrow record id
  const navigate = useNavigate();
  const { state } = useLocation();
  const [record, setRecord] = useState(null);
  const [payment, setPayment] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.getBorrowRecord(id).then(setRecord).catch(e => setLoadError(e.message));
    api.getExtendPaymentQR(id).then(setPayment).catch(e => setError(e.message));
  }
  useEffect(load, [id]);

  function handleFile(e) {
    const f = e.target.files[0];
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmitSlip() {
    if (!file) return setError('กรุณาแนบรูปสลิปการโอนเงิน');
    setError('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('slip_image', file);
      const data = await api.uploadExtendPaymentSlip(id, formData);
      navigate(`/extend/${id}/confirmed`, {
        state: { days: state?.days, dueDate: record?.due_date, fee: payment?.extend_fee, autoVerified: !!data.auto_verified }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div>
        <p className="error-text">{loadError}</p>
        <Link to="/my-book" className="btn-primary auto">ไปที่หนังสือของฉัน</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="book-detail-header">
        <Link to="/my-book" className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">ชำระค่าธรรมเนียมต่ออายุ</span>
      </div>

      {record && (
        <div className="card summary-card">
          <BookCover book={record} />
          <div>
            <h3 style={{ margin: '0 0 3px', fontSize: 15 }}>{record.title}</h3>
            <p className="muted" style={{ margin: 0 }}>ขอต่ออายุ +{record.extend_requested_days} วัน</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="payment-qr-wrap">
          <div className="payment-brand-row">สแกนจ่ายผ่าน PromptPay</div>
          <img src={PROMPTPAY_QR_IMAGE} alt="PromptPay QR Code" />
          <div className="payment-account-name">ชื่อบัญชี: {PROMPTPAY_ACCOUNT_NAME}</div>
          {payment ? (
            <>
              <div className="payment-amount">{payment.amount.toLocaleString()} บาท</div>
              <p className="muted" style={{ textAlign: 'center', fontSize: 12.5, marginTop: 2 }}>
                ค่าธรรมเนียมต่ออายุยืม {payment.extra_days} วัน
              </p>
              <div className="warning-box" style={{ marginTop: 10 }}>
                <AlertIcon size={16} />
                <span>กรุณากรอกยอดเงินเองให้ตรงกับยอดด้านบนก่อนโอน (QR นี้ไม่ได้ฝังยอดเงินไว้อัตโนมัติ)</span>
              </div>
            </>
          ) : !error && <p className="muted center">กำลังโหลดยอดที่ต้องชำระ...</p>}
        </div>
      </div>

      <label>แนบสลิปการโอนเงิน</label>
      <label className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', padding: 26, border: '1.5px dashed var(--border)' }}>
        {preview ? <img src={preview} alt="" style={{ maxWidth: '100%', borderRadius: 10 }} /> : (
          <>
            <CameraIcon size={26} />
            <span className="muted">แตะเพื่อเลือกรูปสลิป (jpg, png)</span>
          </>
        )}
        <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </label>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
        สแกน QR ด้านบนผ่านแอปธนาคารเพื่อชำระเงิน แล้วแคปหน้าจอสลิปยืนยันการโอนมาแนบที่นี่ ระบบจะอ่าน QR บนสลิปเพื่อตรวจสอบอัตโนมัติ (ต้องเป็นสลิปเต็มหน้าจอที่เห็น QR ชัดเจน ห้ามครอปหรือแต่งรูป) หากตรวจอัตโนมัติไม่ได้ เจ้าหน้าที่จะตรวจสอบและต่ออายุยืมให้อีกครั้ง
      </p>

      {error && <p className="error-text">{error}</p>}
      <button className="btn-primary" onClick={handleSubmitSlip} disabled={submitting || !payment}>
        {submitting ? 'กำลังตรวจสอบสลิป...' : 'ส่งสลิปเพื่อยืนยันการต่ออายุ'}
      </button>
    </div>
  );
}
