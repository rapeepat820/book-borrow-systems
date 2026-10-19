import { useEffect, useState } from 'react';
import { api } from '../../api';
import { PlusIcon, TruckIcon } from '../../components/Icons';

const STATUS_LABEL = {
  pending_shipment: 'รอจัดส่ง',
  borrowing: 'กำลังยืม',
  return_requested: 'แจ้งคืนแล้ว รอตรวจสอบ',
  returned: 'คืนสำเร็จ',
  overdue: 'เกินกำหนดคืน'
};

const SHIPPING_STAGES = [
  { key: 'preparing', label: 'กำลังแพ็คสินค้า' },
  { key: 'shipped', label: 'กำลังจัดส่ง' },
  { key: 'out_for_delivery', label: 'ขนส่งกำลังนำส่ง' },
  { key: 'delivered', label: 'จัดส่งสำเร็จ' }
];

const PAYMENT_LABEL = { pending: 'รอชำระเงิน', pending_verification: 'รอตรวจสอบสลิป', paid: 'ชำระแล้ว' };
const PAYMENT_CLASS = { pending: 'pill-payment-pending', pending_verification: 'pill-amber', paid: 'pill-payment-paid' };

const PAGE_SIZE = 8;

export default function AdminBorrowRecords() {
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState(() => new URLSearchParams(window.location.search).get('filter') || '');
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [books, setBooks] = useState([]);
  const [shippingList, setShippingList] = useState([]);
  const [newRecord, setNewRecord] = useState({ user_id: '', book_id: '', shipping_company_id: '', shipping_address: '' });
  const [modalError, setModalError] = useState('');
  const [addressRecord, setAddressRecord] = useState(null);
  const [slipRecord, setSlipRecord] = useState(null);
  const [extendSlipRecord, setExtendSlipRecord] = useState(null);

  // ยืนยันการคืน (คำนวณค่าปรับ) และบันทึกการโอนมัดจำคืน
  const [returnRecord, setReturnRecord] = useState(null);
  const [lateFeeInput, setLateFeeInput] = useState('');
  const [returnError, setReturnError] = useState('');
  const [refundRecord, setRefundRecord] = useState(null);
  const [refundRef, setRefundRef] = useState('');
  const [refundError, setRefundError] = useState('');
  const [busy, setBusy] = useState(false);

  const [shipRecord, setShipRecord] = useState(null);
  const [shipForm, setShipForm] = useState({ shipping_status: 'preparing', tracking_no: '' });
  const [shipError, setShipError] = useState('');

  function load() { api.adminGetBorrowRecords(filter).then(setRecords); }
  useEffect(load, [filter]);
  useEffect(() => { setPage(1); }, [filter]);

  function openModal() {
    api.adminGetMembers().then(setMembers);
    api.adminGetBooks().then(setBooks);
    api.adminGetShipping().then(setShippingList);
    setShowModal(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setModalError('');
    try {
      await api.adminCreateBorrowRecord({
        user_id: Number(newRecord.user_id),
        book_id: Number(newRecord.book_id),
        shipping_company_id: Number(newRecord.shipping_company_id),
        shipping_address: newRecord.shipping_address
      });
      setShowModal(false);
      setNewRecord({ user_id: '', book_id: '', shipping_company_id: '', shipping_address: '' });
      load();
    } catch (err) {
      setModalError(err.message);
    }
  }

  function handleSelectMember(userId) {
    const member = members.find(m => String(m.id) === userId);
    setNewRecord({ ...newRecord, user_id: userId, shipping_address: member?.address || '' });
  }

  function openShipModal(record) {
    setShipRecord(record);
    setShipForm({ shipping_status: record.shipping_status || 'preparing', tracking_no: record.tracking_no || '' });
    setShipError('');
  }

  async function handleUpdateShipping(e) {
    e.preventDefault();
    setShipError('');
    try {
      await api.adminUpdateShippingStatus(shipRecord.id, shipForm.shipping_status, shipForm.tracking_no);
      setShipRecord(null);
      load();
    } catch (err) {
      setShipError(err.message);
    }
  }

  function openReturnModal(r) {
    setReturnRecord(r);
    setLateFeeInput(String(r.late_fee_due ?? 0));
    setReturnError('');
  }

  async function handleConfirmReturn(e) {
    e.preventDefault();
    setReturnError('');
    setBusy(true);
    try {
      await api.adminConfirmReturn(returnRecord.id, { late_fee: Number(lateFeeInput) || 0 });
      setReturnRecord(null);
      load();
    } catch (err) {
      setReturnError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function openRefundModal(r) {
    setRefundRecord(r);
    setRefundRef('');
    setRefundError('');
  }

  async function handleMarkRefunded(e) {
    e.preventDefault();
    setRefundError('');
    setBusy(true);
    try {
      await api.adminMarkRefunded(refundRecord.id, refundRef);
      setRefundRecord(null);
      load();
    } catch (err) {
      setRefundError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResolveExtend(id, approve) {
    await api.adminResolveExtend(id, approve);
    load();
  }

  async function handleVerifyExtendPayment(id, approve) {
    if (!approve && !confirm('ปฏิเสธสลิปนี้? ลูกค้าจะต้องแนบสลิปค่าธรรมเนียมต่ออายุใหม่')) return;
    await api.adminVerifyExtendPayment(id, approve);
    setExtendSlipRecord(null);
    load();
  }

  async function handleVerifyPayment(id, approve) {
    if (!approve && !confirm('ปฏิเสธสลิปนี้? ลูกค้าจะต้องแนบสลิปใหม่')) return;
    await api.adminVerifyPayment(id, approve);
    setSlipRecord(null);
    load();
  }

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const pageRecords = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>รายการยืม-คืน</h1>
          <p className="muted" style={{ margin: 0 }}>แสดงข้อมูลสรุปรายการยืมหนังสือที่กำลังดำเนินการ</p>
        </div>
        <button className="btn-primary auto" onClick={openModal}><PlusIcon size={16} /> เพิ่มรายการใหม่</button>
      </div>

      <div className="table-toolbar">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          <option value="refund_pending">รอโอนมัดจำคืน</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>ชื่อหนังสือ</th><th>ชื่อลูกค้า</th><th>ขนส่ง / สถานะพัสดุ</th>
              <th>กำหนดส่งคืน</th><th>ชำระเงิน</th><th>สถานะ</th><th>หลักฐานคืน</th><th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {pageRecords.map(r => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.full_name}<br /><span className="muted">{r.email}</span></td>
                <td>
                  {r.shipping_company_name}<br />
                  <span className="pill pill-blue" style={{ marginTop: 3, display: 'inline-block' }}>
                    {SHIPPING_STAGES.find(s => s.key === r.shipping_status)?.label || r.shipping_status}
                  </span>
                  {r.tracking_no && <div className="muted" style={{ marginTop: 2 }}>{r.tracking_no}</div>}
                  <div><button type="button" className="btn-link" onClick={() => setAddressRecord(r)}><TruckIcon size={12} style={{ verticalAlign: -1 }} /> ดูที่อยู่จัดส่ง</button></div>
                </td>
                <td>{r.due_date?.slice(0, 10)}</td>
                <td>
                  <span className={`pill ${PAYMENT_CLASS[r.payment_status]}`}>
                    {PAYMENT_LABEL[r.payment_status]}{r.payment_status === 'paid' && r.payment_method === 'cash' ? ' (เงินสด)' : ''}
                  </span>
                  {r.payment_status === 'pending_verification' && (
                    <div style={{ marginTop: 6 }}>
                      <button type="button" className="btn-link" onClick={() => setSlipRecord(r)}>ดูสลิป / ตรวจสอบ</button>
                    </div>
                  )}
                </td>
                <td>
                  <span className={`status-badge status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                  {r.late_days > 0 && ['borrowing', 'return_requested'].includes(r.status) && (
                    <div style={{ marginTop: 6 }}>
                      <span className="status-badge status-overdue">เกินกำหนด {r.late_days} วัน · ปรับ {Number(r.late_fee_due).toLocaleString()} บาท</span>
                    </div>
                  )}
                  {r.status === 'returned' && Number(r.late_fee) > 0 && (
                    <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>หักค่าปรับ {Number(r.late_fee).toLocaleString()} บาท</p>
                  )}
                  {r.status === 'returned' && r.refund_status === 'pending' && (
                    <div style={{ marginTop: 6 }}>
                      <span className="pill pill-amber">รอโอนมัดจำคืน {Number(r.refund_amount).toLocaleString()} บาท</span>
                    </div>
                  )}
                  {r.status === 'returned' && r.refund_status === 'refunded' && (
                    <div style={{ marginTop: 6 }}>
                      <span className="pill pill-green">โอนคืนแล้ว {Number(r.refund_amount).toLocaleString()} บาท</span>
                      {r.refund_reference && <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>อ้างอิง: {r.refund_reference}</p>}
                    </div>
                  )}
                  {r.status === 'returned' && r.refund_status === 'none' && Number(r.late_fee) > 0 && Number(r.refund_amount) === 0 && (
                    <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>ค่าปรับเท่ามัดจำ ไม่มียอดคืน</p>
                  )}
                  {r.extend_status === 'pending' && (
                    <div style={{ marginTop: 6 }}>
                      <span className="pill pill-amber">ขอต่ออายุ +{r.extend_requested_days} วัน ({r.extend_fee} บาท)</span>
                      {r.extend_payment_status === 'pending_verification' ? (
                        <div style={{ marginTop: 4 }}>
                          <button className="btn-link" onClick={() => setExtendSlipRecord(r)}>ตรวจสอบสลิปค่าธรรมเนียม</button>
                        </div>
                      ) : (
                        <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                          {r.extend_payment_status === 'pending' ? 'รอลูกค้าชำระเงิน' : ''}
                        </p>
                      )}
                      <div className="btn-row" style={{ marginTop: 4 }}>
                        <button className="btn-link danger" onClick={() => handleResolveExtend(r.id, false)}>ปฏิเสธคำขอ</button>
                      </div>
                    </div>
                  )}
                </td>
                <td>{r.return_proof_image ? <img className="proof-thumb" src={r.return_proof_image} alt="" /> : '-'}</td>
                <td>
                  {['pending_shipment', 'borrowing'].includes(r.status) && (
                    <button className="btn-link" onClick={() => openShipModal(r)}>อัปเดตสถานะจัดส่ง</button>
                  )}
                  {r.status === 'return_requested' && (
                    <button className="btn-link" onClick={() => openReturnModal(r)}>ตรวจสอบการคืน + คิดค่าปรับ</button>
                  )}
                  {r.status === 'returned' && r.refund_status === 'pending' && (
                    <button className="btn-link" onClick={() => openRefundModal(r)}>บันทึกโอนมัดจำคืน</button>
                  )}
                </td>
              </tr>
            ))}
            {pageRecords.length === 0 && <tr><td colSpan={8} className="muted">ไม่พบรายการ</td></tr>}
          </tbody>
        </table>
        <div className="pagination">
          <span>แสดงรายการ</span>
          <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>ก่อนหน้า</button>
          <button className="page-btn active">{page}</button>
          <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>ถัดไป</button>
        </div>
      </div>

      {returnRecord && (() => {
        const deposit = Number(returnRecord.deposit_amount);
        const fee = Math.min(Math.max(Number(lateFeeInput) || 0, 0), deposit);
        return (
          <div className="modal-backdrop" onClick={() => setReturnRecord(null)}>
            <form className="modal-box" onClick={e => e.stopPropagation()} onSubmit={handleConfirmReturn}>
              <h3>ตรวจสอบการคืนหนังสือ</h3>
              <p className="muted" style={{ marginBottom: 8 }}>{returnRecord.title} — {returnRecord.full_name}</p>
              {returnRecord.return_proof_image && (
                <img src={returnRecord.return_proof_image} alt="หลักฐานการคืน" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)' }} />
              )}
              <div className="summary-row"><span className="label">ค่ามัดจำ</span><span className="value">{deposit.toLocaleString()} บาท</span></div>
              <div className="summary-row">
                <span className="label">เกินกำหนดคืน</span>
                <span className="value">{returnRecord.late_days > 0 ? `${returnRecord.late_days} วัน × ${returnRecord.late_fee_per_day} บาท` : 'ไม่เกินกำหนด'}</span>
              </div>
              <label>ค่าปรับที่หักจากมัดจำ (บาท) — แก้ไขได้ ใส่ 0 เพื่อยกเว้น</label>
              <input type="number" min="0" max={deposit} step="0.01" value={lateFeeInput} onChange={e => setLateFeeInput(e.target.value)} />
              <div className="summary-row"><span className="label">ยอดที่ต้องโอนคืนลูกค้า</span><span className="value"><b>{(deposit - fee).toLocaleString()} บาท</b></span></div>
              <p className="muted" style={{ fontSize: 12.5, margin: '6px 0' }}>
                บัญชีรับเงินคืน: {returnRecord.refund_account_info || 'ลูกค้ายังไม่ได้ระบุ (รายการเก่า) — ติดต่อลูกค้าเพื่อขอบัญชี'}
              </p>
              <p className="muted" style={{ fontSize: 12.5, margin: '0 0 6px' }}>ค่าปรับนับถึงวันที่ลูกค้าแจ้งคืนในระบบ ไม่นับช่วงที่รอแอดมินตรวจสอบ</p>
              {returnError && <p className="error-text">{returnError}</p>}
              <div className="btn-row">
                <button type="button" className="btn-outline" onClick={() => setReturnRecord(null)}>ยกเลิก</button>
                <button className="btn-primary" disabled={busy}>{busy ? 'กำลังบันทึก...' : 'ยืนยันการคืน'}</button>
              </div>
            </form>
          </div>
        );
      })()}

      {refundRecord && (
        <div className="modal-backdrop" onClick={() => setRefundRecord(null)}>
          <form className="modal-box" onClick={e => e.stopPropagation()} onSubmit={handleMarkRefunded}>
            <h3>บันทึกการโอนมัดจำคืน</h3>
            <p className="muted" style={{ marginBottom: 8 }}>{refundRecord.title} — {refundRecord.full_name}</p>
            <div className="summary-row"><span className="label">ยอดที่ต้องโอน</span><span className="value"><b>{Number(refundRecord.refund_amount).toLocaleString()} บาท</b></span></div>
            {Number(refundRecord.late_fee) > 0 && (
              <p className="muted" style={{ fontSize: 12.5, margin: '4px 0' }}>มัดจำ {Number(refundRecord.deposit_amount).toLocaleString()} บาท หักค่าปรับ {Number(refundRecord.late_fee).toLocaleString()} บาท</p>
            )}
            <p style={{ fontSize: 14, lineHeight: 1.7, margin: '8px 0' }}>
              <b>โอนเข้าบัญชี:</b><br />{refundRecord.refund_account_info || 'ลูกค้ายังไม่ได้ระบุบัญชี — ติดต่อลูกค้าเพื่อขอบัญชีก่อน'}
            </p>
            <label>เลขอ้างอิง / หมายเหตุการโอน (ไม่บังคับ)</label>
            <input placeholder="เช่น เวลาโอน หรือเลขอ้างอิงจากสลิป" value={refundRef} onChange={e => setRefundRef(e.target.value)} />
            <p className="muted" style={{ fontSize: 12.5, margin: '6px 0' }}>โอนเงินผ่านแอปธนาคารของร้านก่อน แล้วค่อยกดบันทึก ระบบจะส่งอีเมลแจ้งลูกค้าว่าโอนแล้ว</p>
            {refundError && <p className="error-text">{refundError}</p>}
            <div className="btn-row">
              <button type="button" className="btn-outline" onClick={() => setRefundRecord(null)}>ยกเลิก</button>
              <button className="btn-primary" disabled={busy}>{busy ? 'กำลังบันทึก...' : 'บันทึกว่าโอนแล้ว'}</button>
            </div>
          </form>
        </div>
      )}

      {addressRecord && (
        <div className="modal-backdrop" onClick={() => setAddressRecord(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>ที่อยู่จัดส่ง</h3>
            <p className="muted" style={{ marginBottom: 4 }}>{addressRecord.full_name} — {addressRecord.title}</p>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.7 }}>{addressRecord.shipping_address}</p>
            <button type="button" className="btn-outline" onClick={() => setAddressRecord(null)}>ปิด</button>
          </div>
        </div>
      )}

      {shipRecord && (
        <div className="modal-backdrop" onClick={() => setShipRecord(null)}>
          <form className="modal-box" onClick={e => e.stopPropagation()} onSubmit={handleUpdateShipping}>
            <h3>อัปเดตสถานะจัดส่ง</h3>
            <p className="muted" style={{ marginBottom: 4 }}>{shipRecord.title} — {shipRecord.full_name}</p>
            {shipError && <p className="error-text">{shipError}</p>}
            <label>สถานะการจัดส่ง</label>
            <select value={shipForm.shipping_status} onChange={e => setShipForm({ ...shipForm, shipping_status: e.target.value })}>
              {SHIPPING_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <label>เลข Tracking No.{['shipped', 'out_for_delivery', 'delivered'].includes(shipForm.shipping_status) && ' (จำเป็น)'}</label>
            <input placeholder="เช่น TH1234567890" value={shipForm.tracking_no}
              onChange={e => setShipForm({ ...shipForm, tracking_no: e.target.value })} />
            <div className="btn-row">
              <button type="button" className="btn-outline" onClick={() => setShipRecord(null)}>ยกเลิก</button>
              <button className="btn-primary">บันทึก</button>
            </div>
          </form>
        </div>
      )}

      {slipRecord && (
        <div className="modal-backdrop" onClick={() => setSlipRecord(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>ตรวจสอบสลิปการโอนเงิน</h3>
            <p className="muted" style={{ marginBottom: 10 }}>
              {slipRecord.full_name} — {slipRecord.title} — ยอดที่ต้องชำระ {Number(slipRecord.shipping_fee) + Number(slipRecord.deposit_amount)} บาท
            </p>
            {slipRecord.payment_slip_image ? (
              <img src={slipRecord.payment_slip_image} alt="สลิปการโอนเงิน" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)' }} />
            ) : <p className="muted">ยังไม่มีสลิปแนบ</p>}
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button type="button" className="btn-outline" onClick={() => handleVerifyPayment(slipRecord.id, false)}>ปฏิเสธสลิป</button>
              <button type="button" className="btn-primary" onClick={() => handleVerifyPayment(slipRecord.id, true)}>ยืนยันการชำระเงิน</button>
            </div>
          </div>
        </div>
      )}

      {extendSlipRecord && (
        <div className="modal-backdrop" onClick={() => setExtendSlipRecord(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>ตรวจสอบสลิปค่าธรรมเนียมต่ออายุ</h3>
            <p className="muted" style={{ marginBottom: 10 }}>
              {extendSlipRecord.full_name} — {extendSlipRecord.title} — ขอต่ออายุ +{extendSlipRecord.extend_requested_days} วัน
              — ค่าธรรมเนียม {extendSlipRecord.extend_fee} บาท
            </p>
            {extendSlipRecord.extend_payment_slip_image ? (
              <img src={extendSlipRecord.extend_payment_slip_image} alt="สลิปค่าธรรมเนียมต่ออายุ" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)' }} />
            ) : <p className="muted">ยังไม่มีสลิปแนบ</p>}
            <p className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>
              กดยืนยันแล้วระบบจะบวกวันเข้ากำหนดคืน (due date) ให้ลูกค้าทันที
            </p>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button type="button" className="btn-outline" onClick={() => handleVerifyExtendPayment(extendSlipRecord.id, false)}>ปฏิเสธสลิป</button>
              <button type="button" className="btn-primary" onClick={() => handleVerifyExtendPayment(extendSlipRecord.id, true)}>ยืนยันชำระเงิน + ต่ออายุ</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form className="modal-box" onClick={e => e.stopPropagation()} onSubmit={handleCreate}>
            <h3>เพิ่มรายการยืมใหม่</h3>
            <p className="muted">สำหรับลูกค้าที่ติดต่อทางร้านโดยตรง (ไม่ผ่านหน้าเว็บลูกค้า) — ระบบจะบันทึกว่าชำระเงินสดแล้ว</p>
            {modalError && <p className="error-text">{modalError}</p>}
            <label>ลูกค้า</label>
            <select required value={newRecord.user_id} onChange={e => handleSelectMember(e.target.value)}>
              <option value="">เลือกลูกค้า</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name} ({m.email})</option>)}
            </select>
            <label>หนังสือ</label>
            <select required value={newRecord.book_id} onChange={e => setNewRecord({ ...newRecord, book_id: e.target.value })}>
              <option value="">เลือกหนังสือ</option>
              {books.map(b => <option key={b.id} value={b.id} disabled={b.available_copies < 1}>{b.title} {b.available_copies < 1 ? '(ยืมหมด)' : `(เหลือ ${b.available_copies})`}</option>)}
            </select>
            <label>บริษัทขนส่ง</label>
            <select required value={newRecord.shipping_company_id} onChange={e => setNewRecord({ ...newRecord, shipping_company_id: e.target.value })}>
              <option value="">เลือกบริษัทขนส่ง</option>
              {shippingList.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label>ที่อยู่จัดส่ง</label>
            <textarea placeholder="ที่อยู่จะถูกดึงจากโปรไฟล์ลูกค้าอัตโนมัติ แก้ไขได้ตามต้องการ"
              value={newRecord.shipping_address} onChange={e => setNewRecord({ ...newRecord, shipping_address: e.target.value })} />
            <div className="btn-row">
              <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>ยกเลิก</button>
              <button className="btn-primary">เพิ่มรายการ</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
