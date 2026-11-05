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
  if (!res.ok) {
    const err = new Error(data.message || 'เกิดข้อผิดพลาด');
    err.code = data.code; // เช่น ID_VERIFICATION_REQUIRED ให้หน้าเว็บแสดงลิงก์ไปยืนยันตัวตน
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload, isForm: payload instanceof FormData }),
  getIdentityStatus: () => request('/identity/status'),
  submitIdentity: (formData) => request('/identity/submit', { method: 'POST', body: formData, isForm: true }),
  adminGetIdVerifications: (status) => request(`/admin/id-verifications?status=${status}`),
  adminApproveId: (id) => request(`/admin/id-verifications/${id}/approve`, { method: 'PUT', body: {} }),
  adminRejectId: (id, reason) => request(`/admin/id-verifications/${id}/reject`, { method: 'PUT', body: { reason } }),
  adminFetchIdImage: async (id, kind) => {
    const res = await fetch(`${BASE_URL}/admin/id-verifications/${id}/image/${kind}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error('เปิดรูปไม่ได้');
    return URL.createObjectURL(await res.blob());
  },
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (email, otp, password) => request('/auth/reset-password', { method: 'POST', body: { email, otp, password } }),
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
  getExtendQuote: (id) => request(`/borrow/${id}/extend-quote`),
  requestExtend: (id) => request(`/borrow/${id}/extend-request`, { method: 'POST', body: {} }),
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
  adminUpdateShippingStatus: (id, shipping_status, tracking_no, actual_cost) =>
    request(`/admin/borrow-records/${id}/shipping-status`, { method: 'PUT', body: { shipping_status, tracking_no, actual_cost } }),
  adminGetShippingBoxes: () => request('/admin/shipping-boxes'),
  adminSaveShippingBox: (id, payload) => request(id ? `/admin/shipping-boxes/${id}` : '/admin/shipping-boxes', { method: id ? 'PUT' : 'POST', body: payload }),
  adminDeleteShippingBox: (id) => request(`/admin/shipping-boxes/${id}`, { method: 'DELETE' }),
  adminGetShippingSettings: () => request('/admin/shipping-settings'),
  adminSaveShippingSettings: (payload) => request('/admin/shipping-settings', { method: 'PUT', body: payload }),
  adminShippingTest: (companyId, postal, items) => request(`/admin/shipping-test?company_id=${companyId}&postal=${postal}&items=${items}`),
  adminConfirmReturn: (id, payload = {}) => request(`/admin/borrow-records/${id}/confirm-return`, { method: 'PUT', body: payload }),
  adminMarkRefunded: (id, reference) => request(`/admin/borrow-records/${id}/mark-refunded`, { method: 'PUT', body: { reference } }),
  getQuoteMany: (bookIds, shippingId) => request(`/borrow/quote?book_ids=${bookIds.join(',')}&shipping_company_id=${shippingId}`),
  getReservationStatus: (bookId) => request(`/reservations/status/${bookId}`),
  reserveBook: (bookId) => request('/reservations', { method: 'POST', body: { book_id: bookId } }),
  getMyReservations: () => request('/reservations/my'),
  cancelReservation: (id) => request(`/reservations/${id}`, { method: 'DELETE' }),
  adminGetReport: (from, to) => request(`/admin/reports?from=${from}&to=${to}`),
  adminDownloadReport: async (from, to) => {
    const res = await fetch(`${BASE_URL}/admin/reports/export?from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error('ดาวน์โหลดรายงานไม่สำเร็จ');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = `borrow-report-${from}_${to}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  },
  getContactInfo: () => request('/contact/info'),
  sendContactMessage: (payload) => request('/contact/messages', { method: 'POST', body: payload }),
  getMyContactMessages: () => request('/contact/my'),
  adminGetContactMessages: (status) => request(`/admin/contact-messages${status ? `?status=${status}` : ''}`),
  adminReplyContact: (id, reply) => request(`/admin/contact-messages/${id}/reply`, { method: 'PUT', body: { reply } }),
  adminSetContactStatus: (id, status) => request(`/admin/contact-messages/${id}/status`, { method: 'PUT', body: { status } }),
  adminGetContactSettings: () => request('/admin/contact-settings'),
  adminSaveContactSettings: (payload) => request('/admin/contact-settings', { method: 'PUT', body: payload }),
  adminSendOverdueReminders: () => request('/admin/send-overdue-reminders', { method: 'POST' }),
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
