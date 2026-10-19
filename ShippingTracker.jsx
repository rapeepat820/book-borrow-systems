import { PackageIcon, TruckIcon, HomeIcon, CheckCircleIcon } from './Icons';

const STAGES = [
  { key: 'preparing', label: 'กำลังแพ็คสินค้า', sub: 'ร้านกำลังเตรียมหนังสือและบรรจุพัสดุ', Icon: PackageIcon },
  { key: 'shipped', label: 'กำลังจัดส่ง', sub: 'พัสดุถูกส่งมอบให้บริษัทขนส่งแล้ว', Icon: TruckIcon },
  { key: 'out_for_delivery', label: 'ขนส่งกำลังนำส่ง', sub: 'พนักงานกำลังนำพัสดุไปส่งที่อยู่ของคุณ', Icon: HomeIcon },
  { key: 'delivered', label: 'จัดส่งสำเร็จ', sub: 'ได้รับหนังสือเรียบร้อยแล้ว', Icon: CheckCircleIcon }
];

export default function ShippingTracker({ shippingStatus = 'preparing' }) {
  const currentIndex = Math.max(0, STAGES.findIndex(s => s.key === shippingStatus));

  return (
    <div className="tracker">
      {STAGES.map((stage, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const isLast = i === STAGES.length - 1;
        return (
          <div className="tracker-step" key={stage.key}>
            <div className="tracker-step-indicator">
              <div className={`tracker-dot${done ? ' done' : ''}${current ? ' current' : ''}`}>
                <stage.Icon size={15} />
              </div>
              {!isLast && <div className={`tracker-line${done ? ' done' : ''}`} />}
            </div>
            <div className="tracker-step-body">
              <div className={`tracker-step-title${!done && !current ? ' muted-step' : ''}`}>{stage.label}</div>
              <div className="tracker-step-sub">{stage.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
