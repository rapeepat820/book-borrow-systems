// รวมฟิลด์ที่อยู่แบบ dropdown (province/district/subdistrict/postal_code) + รายละเอียดที่กรอกเอง
// ให้เป็นข้อความที่อยู่แบบเต็มบรรทัดเดียว เก็บไว้ในคอลัมน์ users.address (เพื่อให้จุดอื่นในระบบที่อ่าน
// address เป็นข้อความล้วน เช่น หน้ายืมหนังสือ, หน้าแอดมิน ใช้งานได้ตามปกติโดยไม่ต้องแก้เพิ่ม)
function buildAddressText({ address_detail, subdistrict, district, province, postal_code }) {
  const parts = [];
  if (address_detail && address_detail.trim()) parts.push(address_detail.trim());
  if (subdistrict && subdistrict.trim()) parts.push(`ตำบล/แขวง${subdistrict.trim()}`);
  if (district && district.trim()) parts.push(`อำเภอ/เขต${district.trim()}`);
  if (province && province.trim()) parts.push(`จังหวัด${province.trim()}`);
  if (postal_code && postal_code.trim()) parts.push(postal_code.trim());
  return parts.join(' ');
}

module.exports = { buildAddressText };
