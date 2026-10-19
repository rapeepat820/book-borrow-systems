// โครงโหลดข้อมูล (skeleton) แทนข้อความ "กำลังโหลด..." ให้หน้าดูลื่นไหลขึ้น
export function BookGridSkeleton({ count = 8 }) {
  return (
    <div className="book-grid" aria-busy="true" aria-label="กำลังโหลด">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton" style={{ height: 170 }} />
          <div className="skeleton skeleton-line" style={{ width: '85%' }} />
          <div className="skeleton skeleton-line" style={{ width: '55%' }} />
        </div>
      ))}
    </div>
  );
}

export function CardListSkeleton({ count = 3 }) {
  return (
    <div className="record-list" aria-busy="true" aria-label="กำลังโหลด">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', gap: 12 }}>
          <div className="skeleton" style={{ width: 72, height: 100, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton-line" style={{ width: '70%', marginTop: 4 }} />
            <div className="skeleton skeleton-line" style={{ width: '50%' }} />
            <div className="skeleton skeleton-line" style={{ width: '60%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="กำลังโหลด">
      <div className="skeleton" style={{ height: 36, width: '60%', marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 300, marginBottom: 14 }} />
      <div className="skeleton skeleton-line" style={{ width: '40%' }} />
      <div className="skeleton skeleton-line" style={{ width: '90%', marginTop: 20 }} />
      <div className="skeleton skeleton-line" style={{ width: '80%' }} />
    </div>
  );
}
