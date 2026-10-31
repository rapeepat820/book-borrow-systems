import { useEffect, useState } from 'react';
import { api } from '../../api';

const iso = d => d.toISOString().slice(0, 10);
const daysAgo = n => iso(new Date(Date.now() - n * 86400000));
const baht = n => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });

function Bars({ rows, labelFmt }) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140, overflowX: 'auto', paddingBottom: 4 }}>
      {rows.map(r => (
        <div key={r.label} title={`${labelFmt ? labelFmt(r.label) : r.label}: ${r.n} รายการ`}
          style={{ flex: '1 0 14px', minWidth: 14, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%' }}>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{r.n}</span>
          <div style={{ width: '100%', height: `${Math.max(4, (r.n / max) * 100)}%`, background: 'var(--primary)', borderRadius: '4px 4px 0 0', opacity: 0.9 }} />
        </div>
      ))}
    </div>
  );
}

function HBars({ rows }) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return (
    <div>
      {rows.map(r => (
        <div key={r.label} style={{ margin: '6px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{r.label}</span><b>{r.n}</b></div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(127,127,127,.18)' }}>
            <div style={{ width: `${(r.n / max) * 100}%`, height: '100%', borderRadius: 4, background: 'var(--primary)' }} />
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="muted">ไม่มีข้อมูล</p>}
    </div>
  );
}

export default function AdminReports() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(iso(new Date()));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function load(f = from, t = to) {
    setLoading(true);
    setError('');
    api.adminGetReport(f, t).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function quick(f, t) { setFrom(f); setTo(t); load(f, t); }
  const monthStart = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); };

  const s = data?.summary;
  const labelFmt = data?.range.group === 'month' ? l => l : l => l.slice(5).replace('-', '/');

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>รายงานสถิติ</h1>
          <p className="muted" style={{ margin: 0 }}>สรุปการยืม-คืน รายได้ และการจองคิวตามช่วงวันที่</p>
        </div>
        <button className="btn-secondary auto" onClick={() => api.adminDownloadReport(from, to).catch(e => setError(e.message))}>ดาวน์โหลด CSV</button>
      </div>

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <div><label>ตั้งแต่</label><input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></div>
        <div><label>ถึง</label><input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></div>
        <button className="btn-primary auto" onClick={() => load()} disabled={loading}>{loading ? 'กำลังโหลด...' : 'ดูรายงาน'}</button>
        <div className="chip-row" style={{ margin: 0 }}>
          <button className="chip" onClick={() => quick(daysAgo(6), iso(new Date()))}>7 วัน</button>
          <button className="chip" onClick={() => quick(daysAgo(29), iso(new Date()))}>30 วัน</button>
          <button className="chip" onClick={() => quick(monthStart(), iso(new Date()))}>เดือนนี้</button>
          <button className="chip" onClick={() => quick(daysAgo(364), iso(new Date()))}>12 เดือน</button>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}

      {s && (
        <>
          <div className="stat-grid">
            <div className="card stat-card"><h3>{s.borrows}</h3><p>รายการยืม ({s.borrowers} คน · {s.distinct_books} เรื่อง)</p></div>
            <div className="card stat-card"><h3>{s.returns}</h3><p>คืนแล้ว{s.on_time_rate !== null ? ` · ตรงเวลา ${s.on_time_rate}%` : ''}</p></div>
            <div className="card stat-card"><h3>{s.new_members}</h3><p>สมาชิกใหม่</p></div>
            <div className="card stat-card"><h3>฿{baht(s.income.total)}</h3><p>รายได้ร้าน (ค่าส่ง + ค่าปรับ + ต่ออายุ)</p></div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>รายได้และเงินมัดจำ</h3>
            <table className="data-table">
              <tbody>
                <tr><td>ค่าจัดส่งที่ชำระแล้ว</td><td style={{ textAlign: 'right' }}>฿{baht(s.income.shipping)}</td></tr>
                <tr><td>ค่าปรับเกินกำหนด (หักจากมัดจำ)</td><td style={{ textAlign: 'right' }}>฿{baht(s.income.late_fee)}</td></tr>
                <tr><td>ค่าธรรมเนียมต่ออายุ ({s.extends} ครั้ง)</td><td style={{ textAlign: 'right' }}>฿{baht(s.income.extend)}</td></tr>
                {s.shipping_cost && s.shipping_cost.parcels > 0 && (
                  <tr><td className="muted">ต้นทุนค่าส่งจริง {s.shipping_cost.parcels} พัสดุ (เก็บจากลูกค้า ฿{baht(s.shipping_cost.charged)} → ส่วนต่าง ฿{baht(s.shipping_cost.charged - s.shipping_cost.cost)})</td><td style={{ textAlign: 'right' }} className="muted">฿{baht(s.shipping_cost.cost)}</td></tr>
                )}
                <tr><td><b>รวมรายได้ร้าน</b></td><td style={{ textAlign: 'right' }}><b>฿{baht(s.income.total)}</b></td></tr>
                <tr><td className="muted">มัดจำที่รับเข้ามา (ไม่ใช่รายได้ ต้องคืนลูกค้า)</td><td style={{ textAlign: 'right' }} className="muted">฿{baht(s.deposits_received)}</td></tr>
                <tr><td className="muted">โอนมัดจำคืนลูกค้าแล้ว</td><td style={{ textAlign: 'right' }} className="muted">฿{baht(s.refunded)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="stat-grid">
            <div className="card stat-card warn"><h3>฿{baht(data.now.deposits_held)}</h3><p>เงินมัดจำที่ถืออยู่ตอนนี้</p></div>
            <div className="card stat-card warn"><h3>฿{baht(data.now.refunds_pending)}</h3><p>รอโอนมัดจำคืน</p></div>
            <div className="card stat-card warn"><h3>{data.now.overdue_now}</h3><p>เกินกำหนดคืนตอนนี้</p></div>
            <div className="card stat-card"><h3>{data.now.out_of_stock}/{data.now.total_titles}</h3><p>เรื่องที่ถูกยืมหมด</p></div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>จำนวนการยืม{data.range.group === 'month' ? 'รายเดือน' : 'รายวัน'}</h3>
            {data.series.length ? <Bars rows={data.series} labelFmt={labelFmt} /> : <p className="muted">ไม่มีการยืมในช่วงนี้</p>}
            {data.series.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--muted)' }}>
                <span>{labelFmt(data.series[0].label)}</span><span>{labelFmt(data.series[data.series.length - 1].label)}</span>
              </div>
            )}
          </div>

          <div className="grid-2">
            <div className="card">
              <h3 style={{ marginTop: 0 }}>หนังสือยอดนิยม 10 อันดับ</h3>
              <HBars rows={data.top_books.map(b => ({ label: b.title, n: b.n }))} />
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>แยกตามประเภทหนังสือ</h3>
              <HBars rows={data.by_type} />
              <h3>สมาชิกที่ยืมมากที่สุด</h3>
              <HBars rows={data.top_members} />
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <h3 style={{ marginTop: 0 }}>การจองคิว</h3>
              <p className="muted" style={{ margin: '0 0 8px' }}>
                จองใหม่ {data.reservations.created} · ยืมสำเร็จ {data.reservations.fulfilled} · หมดเวลา {data.reservations.expired} · รอคิวอยู่ตอนนี้ {data.reservations.waiting_now}
              </p>
              {data.reservations.queue.length ? (
                <table className="data-table">
                  <thead><tr><th>หนังสือที่มีคนรอมากสุด</th><th style={{ textAlign: 'right' }}>คนรอ</th></tr></thead>
                  <tbody>{data.reservations.queue.map(q => <tr key={q.id}><td>{q.title}</td><td style={{ textAlign: 'right' }}>{q.n}</td></tr>)}</tbody>
                </table>
              ) : <p className="muted">ยังไม่มีคิวรอ</p>}
              <p className="muted" style={{ fontSize: 12.5 }}>เล่มที่มีคนรอเยอะ ควรพิจารณาเพิ่มจำนวนเล่ม</p>
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>ออเดอร์ยืมหลายเล่ม</h3>
              <p style={{ fontSize: 22, margin: '4px 0' }}><b>{data.orders.multi_orders}</b> <span className="muted" style={{ fontSize: 14 }}>ออเดอร์ · รวม {data.orders.multi_books} เล่ม</span></p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
