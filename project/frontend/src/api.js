// ตัวช่วยกลางสำหรับเรียก API ของ backend ทุกจุด
const BASE_URL = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'เกิดข้อผิดพลาด');
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: { token, password } }),
  changePassword: (payload) => request('/auth/change-password', { method: 'POST', body: payload }),
  getMe: () => request('/auth/me'),
  updateMe: (payload) => request('/auth/me', { method: 'PUT', body: payload }),

  getBooks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('/books' + (qs ? `?${qs}` : ''));
  },
  getBook: (id) => request(`/books/${id}`),
  getBookTypes: () => request('/books/meta/types'),
  getShippingCompanies: () => request('/books/meta/shipping-companies'),

  getQuote: (book_id, shipping_company_id) =>
    request(`/borrow/quote?book_id=${book_id}&shipping_company_id=${shipping_company_id}`),
  createBorrow: (payload) => request('/borrow', { method: 'POST', body: payload }),
  getMyBorrows: () => request('/borrow/my'),
  getBorrowRecord: (id) => request(`/borrow/${id}`),
  getPaymentQR: (id) => request(`/borrow/${id}/payment-qr`),
  uploadPaymentSlip: (id, formData) => request(`/borrow/${id}/payment-slip`, { method: 'POST', body: formData, isForm: true }),
  requestExtend: (id, extra_days) => request(`/borrow/${id}/extend-request`, { method: 'POST', body: { extra_days } }),
  getExtendPaymentQR: (id) => request(`/borrow/${id}/extend-payment-qr`),
  uploadExtendPaymentSlip: (id, formData) => request(`/borrow/${id}/extend-payment-slip`, { method: 'POST', body: formData, isForm: true }),
  submitReturn: (id, formData) => request(`/borrow/${id}/return`, { method: 'POST', body: formData, isForm: true }),

  // Admin
  adminDashboard: () => request('/admin/dashboard'),
  adminSendDueReminders: () => request('/admin/send-due-reminders', { method: 'POST' }),
  adminGetBooks: () => request('/admin/books'),
  adminCreateBook: (payload) => request('/admin/books', { method: 'POST', body: payload }),
  adminUpdateBook: (id, payload) => request(`/admin/books/${id}`, { method: 'PUT', body: payload }),
  adminDeleteBook: (id) => request(`/admin/books/${id}`, { method: 'DELETE' }),
  adminAutoFillBooks: () => request('/admin/books/auto-fill', { method: 'POST' }),
  adminAutoFillStatus: () => request('/admin/books/auto-fill/status'),
  adminLookupBook: (params) => request('/admin/books/lookup?' + new URLSearchParams(params)),
  adminUploadBookCover: (formData) => request('/admin/books/upload-cover', { method: 'POST', body: formData, isForm: true }),

  adminGetBookTypes: () => request('/admin/book-types'),
  adminCreateBookType: (payload) => request('/admin/book-types', { method: 'POST', body: payload }),
  adminUpdateBookType: (id, payload) => request(`/admin/book-types/${id}`, { method: 'PUT', body: payload }),
  adminDeleteBookType: (id) => request(`/admin/book-types/${id}`, { method: 'DELETE' }),

  adminGetShipping: () => request('/admin/shipping-companies'),
  adminCreateShipping: (payload) => request('/admin/shipping-companies', { method: 'POST', body: payload }),
  adminUpdateShipping: (id, payload) => request(`/admin/shipping-companies/${id}`, { method: 'PUT', body: payload }),
  adminActivateShipping: (id) => request(`/admin/shipping-companies/${id}/activate`, { method: 'PUT' }),

  adminGetMembers: () => request('/admin/members'),
  adminCreateMember: (payload) => request('/admin/members', { method: 'POST', body: payload }),

  adminGetBorrowRecords: (status) => request('/admin/borrow-records' + (status ? `?status=${status}` : '')),
  adminCreateBorrowRecord: (payload) => request('/admin/borrow-records', { method: 'POST', body: payload }),
  adminUpdateShippingStatus: (id, shipping_status, tracking_no) =>
    request(`/admin/borrow-records/${id}/shipping-status`, { method: 'PUT', body: { shipping_status, tracking_no } }),
  adminConfirmReturn: (id) => request(`/admin/borrow-records/${id}/confirm-return`, { method: 'PUT' }),
  adminResolveExtend: (id, approve) => request(`/admin/borrow-records/${id}/resolve-extend`, { method: 'PUT', body: { approve } }),
  adminVerifyExtendPayment: (id, approve) => request(`/admin/borrow-records/${id}/verify-extend-payment`, { method: 'PUT', body: { approve } }),
  adminVerifyPayment: (id, approve) => request(`/admin/borrow-records/${id}/verify-payment`, { method: 'PUT', body: { approve } })
};

export function saveSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}
export function getSession() {
  const user = localStorage.getItem('user');
  return { token: getToken(), user: user ? JSON.parse(user) : null };
}
export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
