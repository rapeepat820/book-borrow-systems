import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import BookCover from '../components/BookCover';
import { ChevronLeftIcon, CameraIcon, AlertIcon } from '../components/Icons';
import RefundAccountFields, { EMPTY_REFUND, refundFromProfile } from '../components/RefundAccountFields';

export default function ReturnBook() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refund, setRefund] = useState(EMPTY_REFUND);

  useEffect(() => { api.getBorrowRecord(id).then(setRecord); }, [id]);
  // เติมบัญชีรับเงินคืนจากโปรไฟล์ให้อัตโนมัติ (แก้ไขได้)
  useEffect(() => { api.getMe().then(me => setRefund(refundFromProfile(me))).catch(() => {}); }, []);

  function handleFile(e) {
    const f = e.target.files[0];
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmit() {
    if (!file) return setError('กรุณาแนบรูปภาพหลักฐานการคืนหนังสือ');
    setError('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('proof_image', file);
      Object.entries(refund).forEach(([k, v]) => formData.append(k, v));
      await api.submitReturn(id, formData);
      navigate('/my-book');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!record) return <p className="muted">กำลังโหลด...</p>;

  return (
    <div>
      <div className="book-detail-header">
        <Link to="/my-book" className="back-circle" style={{ marginBottom: 0 }}><ChevronLeftIcon size={18} /></Link>
        <span className="book-detail-title">คืนหนังสือ</span>
      </div>

      <div className="card summary-card">
        <BookCover book={record} />
        <div>
          <h3 style={{ margin: '0 0 3px', fontSize: 15 }}>{record.title}</h3>
          <p className="muted" style={{ margin: 0 }}>กำหนดคืน {record.due_date?.slice(0, 10)}</p>
        </div>
      </div>

      <div className="warning-box">
        <AlertIcon size={17} />
        <span>กรุณาแนบรูปถ่ายสภาพหนังสือเป็นหลักฐานการคืนก่อนส่งพัสดุ เจ้าหน้าที่จะตรวจสอบแล้วโอนเงินมัดจำคืนเข้าบัญชีที่คุณระบุด้านล่าง</span>
      </div>

      {record.is_overdue && (
        <div className="warning-box" style={{ borderColor: 'var(--danger)' }}>
          <AlertIcon size={17} />
          <span>
            หนังสือเล่มนี้เลยกำหนดคืนมา {record.late_days} วัน ค่าปรับสะสม <b>{Number(record.late_fee_due).toLocaleString()} บาท</b>
            (วันละ {record.late_fee_per_day} บาท) จะถูกหักจากเงินมัดจำ ค่าปรับจะหยุดนับเมื่อคุณส่งหลักฐานการคืนในหน้านี้
          </span>
        </div>
      )}

      <label>รูปถ่ายหลักฐานการคืน</label>
      <label className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', padding: 26, border: '1.5px dashed var(--border)' }}>
        {preview ? <img src={preview} alt="" style={{ maxWidth: '100%', borderRadius: 10 }} /> : (
          <>
            <CameraIcon size={26} />
            <span className="muted">แตะเพื่อเลือกรูปภาพ (jpg, png)</span>
          </>
        )}
        <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </label>

      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 14.5, margin: '0 0 4px' }}>บัญชีรับเงินมัดจำคืน ({Number(record.deposit_amount).toLocaleString()} บาท)</h3>
        <p className="muted" style={{ margin: '0 0 6px', fontSize: 12.5 }}>กรุณาตรวจสอบให้ถูกต้อง เราจะโอนเข้าบัญชีนี้เท่านั้น</p>
        <RefundAccountFields value={refund} onChange={patch => setRefund(r => ({ ...r, ...patch }))} required />
      </div>

      {error && <p className="error-text">{error}</p>}
      <button className="btn-primary" style={{ marginTop: 16 }} onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'กำลังส่ง...' : 'ยืนยันส่งหลักฐานการคืน'}
      </button>
    </div>
  );
}
