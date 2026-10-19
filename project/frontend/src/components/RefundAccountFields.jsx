// ฟอร์มกรอกบัญชีรับเงินมัดจำคืน (พร้อมเพย์ หรือ บัญชีธนาคาร) ใช้ร่วมกันในหน้าแก้ไขโปรไฟล์และหน้าแจ้งคืนหนังสือ
export const BANKS = [
  'ธนาคารกสิกรไทย', 'ธนาคารไทยพาณิชย์', 'ธนาคารกรุงเทพ', 'ธนาคารกรุงไทย', 'ธนาคารกรุงศรีอยุธยา',
  'ธนาคารทหารไทยธนชาต (ttb)', 'ธนาคารออมสิน', 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)',
  'ธนาคารอาคารสงเคราะห์ (ธอส.)', 'ธนาคารยูโอบี', 'ธนาคารซีไอเอ็มบี ไทย', 'ธนาคารแลนด์ แอนด์ เฮ้าส์', 'ธนาคารอื่นๆ'
];

export const EMPTY_REFUND = { refund_method: '', refund_bank: '', refund_account_no: '', refund_account_name: '' };

export function refundFromProfile(me) {
  return {
    refund_method: me?.refund_method || '',
    refund_bank: me?.refund_bank || '',
    refund_account_no: me?.refund_account_no || '',
    refund_account_name: me?.refund_account_name || ''
  };
}

export default function RefundAccountFields({ value, onChange, required = false }) {
  const method = value.refund_method;
  return (
    <div>
      <label>ช่องทางรับเงินมัดจำคืน{required && <span className="required-mark">*</span>}</label>
      <select required={required} value={method} onChange={e => onChange({ refund_method: e.target.value })}>
        <option value="">เลือกช่องทางรับเงิน</option>
        <option value="promptpay">พร้อมเพย์ (เบอร์โทร / เลขบัตรประชาชน)</option>
        <option value="bank">โอนเข้าบัญชีธนาคาร</option>
      </select>

      {method === 'bank' && (
        <>
          <label>ธนาคาร{required && <span className="required-mark">*</span>}</label>
          <select required={required} value={value.refund_bank} onChange={e => onChange({ refund_bank: e.target.value })}>
            <option value="">เลือกธนาคาร</option>
            {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </>
      )}

      {method && (
        <>
          <label>{method === 'promptpay' ? 'เบอร์พร้อมเพย์ (เบอร์โทร 10 หลัก หรือเลขบัตร 13 หลัก)' : 'เลขบัญชี'}{required && <span className="required-mark">*</span>}</label>
          <input required={required} inputMode="numeric" placeholder={method === 'promptpay' ? '0812345678' : '1234567890'}
            value={value.refund_account_no} onChange={e => onChange({ refund_account_no: e.target.value })} />
          <label>ชื่อบัญชี{required && <span className="required-mark">*</span>}</label>
          <input required={required} placeholder="ชื่อ-นามสกุลตามบัญชี"
            value={value.refund_account_name} onChange={e => onChange({ refund_account_name: e.target.value })} />
        </>
      )}
    </div>
  );
}
