import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { BookStackIcon, RepeatIcon, UsersIcon, AlertIcon, PackageIcon } from '../../components/Icons';

const STATUS_LABEL = {
  pending_shipment: 'รอจัดส่ง',
  borrowing: 'กำลังยืม',
  return_requested: 'รอตรวจสอบการคืน',
  returned: 'คืนแล้ว',
  overdue: 'เกินกำหนดคืน'
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [sending, setSending] = useState(false);
  const [reminderResult, setReminderResult] = useState('');
  const [sendingOverdue, setSendingOverdue] = useState(false);

  useEffect(() => {
    api.adminDashboard().then(setStats);
    api.adminGetBorrowRecords().then(rows => setRecent(rows.slice(0, 5)));
  }, []);

  async function handleSendReminders() {
    setSending(true);
    setReminderResult('');
    try {
      const result = await api.adminSendDueReminders();
      setReminderResult(result.message);
    } catch (err) {
      setReminderResult(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleSendOverdue() {
    setSendingOverdue(true);
    setReminderResult('');
    try {
      const result = await api.adminSendOverdueReminders();
      setReminderResult(result.message);
    } catch (err) {
      setReminderResult(err.message);
    } finally {
      setSendingOverdue(false);
    }
  }

  if (!stats) return (
    <div aria-busy="true">
      <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 22 }} />
      <div className="stat-grid">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />)}</div>
    </div>
  );

  return (
    <div>
      <div className="admin-header"><div><h1>Dashboard</h1><p className="muted" style={{ margin: 0 }}>ภาพรวมระบบยืม-คืนหนังสือวันนี้</p></div></div>

      <div className="stat-grid">
        <div className="card stat-card">
          <div className="stat-card-icon"><BookStackIcon size={20} /></div>
          <h3>{stats.totalBooks}</h3>
          <p>หนังสือทั้งหมด</p>
        </div>
        <div className="card stat-card">
          <div className="stat-card-icon"><RepeatIcon size={20} /></div>
          <h3>{stats.activeBorrows}</h3>
          <p>กำลังยืมอยู่</p>
        </div>
        <div className="card stat-card">
          <div className="stat-card-icon"><UsersIcon size={20} /></div>
          <h3>{stats.totalMembers}</h3>
          <p>ลูกค้าใหม่</p>
        </div>
        <Link to="/admin/borrow-records?filter=overdue" className="card stat-card link warn">
          <div className="stat-card-icon"><AlertIcon size={20} /></div>
          <h3>{stats.overdueCount}</h3>
          <p>เกินกำหนดคืน</p>
        </Link>
      </div>

      <div className="section-title" style={{ margin: '8px 0 12px' }}>รายการที่ต้องดำเนินการ</div>
      <div className="stat-grid">
        <Link to="/admin/borrow-records" className="card stat-card link warn">
          <div className="stat-card-icon"><PackageIcon size={20} /></div>
          <h3>{stats.pendingPaymentVerification}</h3>
          <p>รอตรวจสอบสลิปชำระเงิน</p>
        </Link>
        <Link to="/admin/borrow-records" className="card stat-card link warn">
          <div className="stat-card-icon"><RepeatIcon size={20} /></div>
          <h3>{stats.pendingExtendVerification}</h3>
          <p>รอตรวจสอบสลิปค่าธรรมเนียมต่ออายุ</p>
        </Link>
        <Link to="/admin/borrow-records" className="card stat-card link">
          <div className="stat-card-icon"><BookStackIcon size={20} /></div>
          <h3>{stats.pendingReturnCheck}</h3>
          <p>รอตรวจสอบการคืนหนังสือ</p>
        </Link>
        <Link to="/admin/contact" className="card stat-card link warn">
          <div className="stat-card-icon"><AlertIcon size={20} /></div>
          <h3>{stats.newMessages ?? 0}</h3>
          <p>ข้อความติดต่อใหม่</p>
        </Link>
        <Link to="/admin/borrow-records?filter=refund_pending" className="card stat-card link warn">
          <div className="stat-card-icon"><RepeatIcon size={20} /></div>
          <h3>{stats.pendingRefunds ?? 0}</h3>
          <p>รอโอนเงินมัดจำคืนลูกค้า</p>
        </Link>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div>
            <h3 style={{ margin: 0 }}>อีเมลแจ้งเตือนใกล้ครบกำหนดคืน</h3>
            <p className="muted" style={{ margin: '2px 0 0' }}>ปกติระบบส่งอัตโนมัติทุกวัน 08:00 น. — กดปุ่มนี้เพื่อสั่งส่งทันที (ใช้ทดสอบ)</p>
          </div>
          <div className="btn-row">
            <button className="btn-secondary auto" onClick={handleSendReminders} disabled={sending}>
              {sending ? 'กำลังส่ง...' : 'ส่งอีเมลแจ้งเตือนตอนนี้'}
            </button>
            <button className="btn-secondary auto" onClick={handleSendOverdue} disabled={sendingOverdue}>
              {sendingOverdue ? 'กำลังส่ง...' : 'ส่งอีเมลเตือนเกินกำหนด'}
            </button>
          </div>
        </div>
        {reminderResult && <p className="pill pill-blue" style={{ display: 'block', padding: 10, marginTop: 4 }}>{reminderResult}</p>}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <h3 style={{ margin: 0 }}>รายการล่าสุด</h3>
          <Link to="/admin/borrow-records" className="btn-link">จัดการทั้งหมด</Link>
        </div>
        <table className="data-table">
          <thead><tr><th>ผู้ยืม</th><th>หนังสือ</th><th>กำหนดคืน</th><th>สถานะ</th></tr></thead>
          <tbody>
            {recent.map(r => (
              <tr key={r.id}>
                <td>{r.full_name}</td>
                <td>{r.title}</td>
                <td>{r.due_date?.slice(0, 10)}</td>
                <td><span className={`status-badge status-${r.status}`}>{STATUS_LABEL[r.status]}</span></td>
              </tr>
            ))}
            {recent.length === 0 && <tr><td colSpan={4} className="muted">ยังไม่มีรายการ</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
