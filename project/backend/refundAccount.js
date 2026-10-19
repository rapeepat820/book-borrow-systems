// ตรวจสอบและจัดรูปแบบบัญชีรับเงินมัดจำคืนของลูกค้า (พร้อมเพย์ หรือ บัญชีธนาคาร)

function digits(v) { return String(v || '').replace(/\D/g, ''); }

// รับข้อมูลดิบจากฟอร์ม คืน { ok, data, message }
function parseRefundAccount(body) {
  const method = String(body.refund_method || '').trim();
  const name = String(body.refund_account_name || '').trim();
  const no = digits(body.refund_account_no);
  const bank = String(body.refund_bank || '').trim();

  if (!['promptpay', 'bank'].includes(method)) {
    return { ok: false, message: 'กรุณาเลือกช่องทางรับเงินมัดจำคืน (พร้อมเพย์หรือบัญชีธนาคาร)' };
  }
  if (!name) return { ok: false, message: 'กรุณากรอกชื่อบัญชีรับเงินคืน' };
  if (method === 'promptpay') {
    if (![10, 13].includes(no.length)) {
      return { ok: false, message: 'เลขพร้อมเพย์ต้องเป็นเบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก' };
    }
    return { ok: true, data: { refund_method: 'promptpay', refund_bank: null, refund_account_no: no, refund_account_name: name } };
  }
  if (!bank) return { ok: false, message: 'กรุณาเลือกธนาคาร' };
  if (no.length < 10 || no.length > 15) return { ok: false, message: 'เลขบัญชีธนาคารต้องมี 10-15 หลัก' };
  return { ok: true, data: { refund_method: 'bank', refund_bank: bank, refund_account_no: no, refund_account_name: name } };
}

// ข้อความสรุปบัญชี สำหรับให้แอดมินเห็นตอนโอนคืน
function formatRefundAccount(d) {
  if (!d || !d.refund_method) return null;
  return d.refund_method === 'promptpay'
    ? `พร้อมเพย์ ${d.refund_account_no} · ชื่อ ${d.refund_account_name}`
    : `${d.refund_bank} · เลขบัญชี ${d.refund_account_no} · ชื่อ ${d.refund_account_name}`;
}

module.exports = { parseRefundAccount, formatRefundAccount };
