// สร้างปกหนังสือ/หมวดหมู่แบบ gradient ที่สม่ำเสมอ (deterministic) จากชื่อ
// ใช้แทนรูปจริงกรณีไม่มี cover_image เพื่อให้ทุกเล่ม/ทุกหมวดหมู่มี "รูป" ที่ดูเป็นมืออาชีพ ไม่ต้องพึ่งพาอินเทอร์เน็ต

const PALETTES = [
  ['#4f7df3', '#2447c9'],
  ['#22b8a0', '#0d7d6d'],
  ['#f0904a', '#c2601e'],
  ['#c25ce0', '#7a2fb0'],
  ['#ef5f77', '#b32846'],
  ['#3fb3e0', '#1a6fa8'],
  ['#8ac24a', '#4d8a1f'],
  ['#f2b705', '#c98705']
];

function hashString(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function paletteFor(seed) {
  const idx = hashString(seed) % PALETTES.length;
  return PALETTES[idx];
}

export function gradientFor(seed) {
  const [c1, c2] = paletteFor(seed);
  return `linear-gradient(160deg, ${c1}, ${c2})`;
}
