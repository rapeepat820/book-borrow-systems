// ตะกร้าหนังสือ (เก็บในเครื่องผู้ใช้) — เลือกหลายเล่มแล้วยืมพร้อมกันในออเดอร์เดียว
const KEY = 'book_cart';
export const MAX_CART_ITEMS = 5; // ให้ตรงกับ MAX_BOOKS_PER_ORDER ฝั่งเซิร์ฟเวอร์ (เซิร์ฟเวอร์เป็นตัวตัดสินจริง)

export function getCart() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.map(Number).filter(n => Number.isInteger(n) && n > 0) : [];
  } catch {
    return [];
  }
}

function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('cart-changed'));
}

export function addToCart(id) {
  const list = getCart();
  const n = Number(id);
  if (list.includes(n)) return { ok: true, already: true };
  if (list.length >= MAX_CART_ITEMS) return { ok: false, message: `ตะกร้าใส่ได้สูงสุด ${MAX_CART_ITEMS} เล่ม` };
  save([...list, n]);
  return { ok: true };
}

export function removeFromCart(id) {
  save(getCart().filter(x => x !== Number(id)));
}

export function clearCart() {
  save([]);
}

export function inCart(id) {
  return getCart().includes(Number(id));
}
