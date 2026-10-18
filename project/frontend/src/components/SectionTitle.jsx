/**
 * หัวข้อของแต่ละหมวดในหน้าต่างๆ (เช่น "หนังสือแนะนำ", "เพิ่มเข้ามาใหม่ล่าสุด")
 * ตกแต่งให้ดูมีมิติกว่าตัวหนังสือตัวหนาเฉยๆ — มีไอคอนในกล่องสี + เส้นเน้นสี + ป้ายจำนวน/ลิงก์ด้านขวา (ถ้ามี)
 */
export default function SectionTitle({ icon, title, sub, right, style }) {
  return (
    <div className="section-header" style={style}>
      <span className="section-header-bar" />
      {icon && <span className="section-header-icon">{icon}</span>}
      <span className="section-header-text">
        <span className="section-header-title">{title}</span>
        {sub && <span className="section-header-sub">{sub}</span>}
      </span>
      {right && <span className="section-header-right">{right}</span>}
    </div>
  );
}
