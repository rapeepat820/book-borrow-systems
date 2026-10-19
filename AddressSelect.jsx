import { useEffect, useMemo, useState } from 'react';

// โหลดข้อมูลจังหวัด/อำเภอ/ตำบลแบบ lazy (~400KB) เพื่อไม่ให้ไปรวมอยู่ใน bundle หลักของแอพ
let cachedTree = null;
function loadAddressTree() {
  if (cachedTree) return Promise.resolve(cachedTree);
  return import('../data/thaiAddress.json').then(mod => {
    cachedTree = mod.default || mod;
    return cachedTree;
  });
}

/**
 * ตัวเลือกที่อยู่แบบ dropdown เรียงลำดับ จังหวัด → อำเภอ/เขต → ตำบล/แขวง
 * แล้วเติมรหัสไปรษณีย์ให้อัตโนมัติตามตำบลที่เลือก
 *
 * value: { province, district, subdistrict, postal_code }
 * onChange(partial): เรียกกลับพร้อม object ของฟิลด์ที่เปลี่ยน ให้ merge เข้ากับ state ฟอร์มหลักเอง
 */
export default function AddressSelect({ value, onChange, required = true }) {
  const [tree, setTree] = useState(null);

  useEffect(() => { loadAddressTree().then(setTree); }, []);

  const provinceObj = useMemo(
    () => tree?.find(p => p.name === value.province) || null,
    [tree, value.province]
  );
  const districtObj = useMemo(
    () => provinceObj?.amphoes.find(a => a.name === value.district) || null,
    [provinceObj, value.district]
  );

  function handleProvince(e) {
    onChange({ province: e.target.value, district: '', subdistrict: '', postal_code: '' });
  }
  function handleDistrict(e) {
    onChange({ district: e.target.value, subdistrict: '', postal_code: '' });
  }
  function handleSubdistrict(e) {
    const name = e.target.value;
    const tambon = districtObj?.tambons.find(t => t.name === name);
    onChange({ subdistrict: name, postal_code: tambon ? tambon.zip : '' });
  }

  if (!tree) {
    return <p className="muted" style={{ margin: '8px 0' }}>กำลังโหลดข้อมูลจังหวัด/อำเภอ/ตำบล...</p>;
  }

  return (
    <div className="form-row">
      <div>
        <label>จังหวัด{required && <span className="required-mark">*</span>}</label>
        <select required={required} value={value.province || ''} onChange={handleProvince}>
          <option value="">เลือกจังหวัด</option>
          {tree.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      <div>
        <label>อำเภอ/เขต{required && <span className="required-mark">*</span>}</label>
        <select required={required} value={value.district || ''} onChange={handleDistrict} disabled={!provinceObj}>
          <option value="">{provinceObj ? 'เลือกอำเภอ/เขต' : 'เลือกจังหวัดก่อน'}</option>
          {provinceObj?.amphoes.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
        </select>
      </div>

      <div>
        <label>ตำบล/แขวง{required && <span className="required-mark">*</span>}</label>
        <select required={required} value={value.subdistrict || ''} onChange={handleSubdistrict} disabled={!districtObj}>
          <option value="">{districtObj ? 'เลือกตำบล/แขวง' : 'เลือกอำเภอ/เขตก่อน'}</option>
          {districtObj?.tambons.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
      </div>

      <div>
        <label>รหัสไปรษณีย์</label>
        <input value={value.postal_code || ''} readOnly placeholder="เติมอัตโนมัติ" />
      </div>
    </div>
  );
}
