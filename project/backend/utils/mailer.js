const nodemailer = require('nodemailer');
require('dotenv').config();

// ค่าตัวอย่างจาก .env.example — ถ้ายังเป็นค่าเหล่านี้ถือว่า "ยังไม่ได้ตั้งค่า" (ไม่งั้นจะพยายามล็อกอิน Gmail ด้วยรหัสปลอมแล้วส่งไม่ผ่าน)
const PLACEHOLDERS = ['your_email@gmail.com', 'your_gmail_app_password'];

// ส่งผ่าน Brevo (HTTP API) — เหมาะกับ Railway ที่มักบล็อก SMTP: ตั้ง BREVO_API_KEY + MAIL_FROM_EMAIL
function isBrevoConfigured() {
  return !!(process.env.BREVO_API_KEY && process.env.MAIL_FROM_EMAIL);
}

function isSmtpConfigured() {
  const { SMTP_USER, SMTP_PASS } = process.env;
  return !!(SMTP_USER && SMTP_PASS && !PLACEHOLDERS.includes(SMTP_USER) && !PLACEHOLDERS.includes(SMTP_PASS));
}

function isMailConfigured() {
  return isBrevoConfigured() || isSmtpConfigured();
}

async function sendViaBrevo(to, subject, html) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify({
      sender: { name: process.env.MAIL_FROM_NAME || 'RP Bookstore', email: process.env.MAIL_FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`Brevo ${res.status}: ${detail}`);
    err.hint = res.status === 401
      ? 'BREVO_API_KEY ไม่ถูกต้อง'
      : 'Brevo ปฏิเสธการส่ง — ตรวจว่า MAIL_FROM_EMAIL เป็นผู้ส่งที่ยืนยันแล้วใน Brevo (Senders & IP)';
    throw err;
  }
}

// ตั้งค่า transporter จาก .env (รองรับ Gmail SMTP หรือผู้ให้บริการอื่น)
// พอร์ต 465 ใช้ SSL โดยตรง ส่วน 587 ใช้ STARTTLS
let transporter = null;
function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || '').replace(/\s+/g, '') },
      connectionTimeout: 15000,
      greetingTimeout: 15000
    });
  }
  return transporter;
}

function explainMailError(err) {
  if (err.code === 'EAUTH' || err.responseCode === 535) {
    return 'ล็อกอิน SMTP ไม่ผ่าน — ถ้าใช้ Gmail ต้องเปิดการยืนยัน 2 ขั้นตอน แล้วสร้าง "รหัสผ่านแอป" 16 หลักมาใส่ SMTP_PASS (ห้ามใช้รหัสผ่าน Gmail ปกติ)';
  }
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS'].includes(err.code)) {
    return 'เชื่อมต่อเซิร์ฟเวอร์ SMTP ไม่ได้ — ตรวจสอบอินเทอร์เน็ต/ไฟร์วอลล์ และค่า SMTP_HOST, SMTP_PORT';
  }
  return err.message;
}

// คืนค่า true เมื่อส่งสำเร็จ, false เมื่อยังไม่ได้ตั้งค่า SMTP (ข้ามการส่ง), และ throw เมื่อส่งไม่สำเร็จ
async function sendMail(to, subject, html) {
  if (!isMailConfigured()) {
    console.log('[mailer] ยังไม่ได้ตั้งค่าอีเมล (BREVO_API_KEY หรือ SMTP) - ข้ามการส่ง:', subject, '->', to);
    return false;
  }
  try {
    if (isBrevoConfigured()) {
      await sendViaBrevo(to, subject, html);
      return true;
    }
    await getTransporter().sendMail({
      from: `"ระบบยืม-คืนหนังสือออนไลน์" <${process.env.SMTP_USER}>`,
      to, subject, html
    });
    return true;
  } catch (err) {
    err.hint = explainMailError(err);
    console.error('[mailer] ส่งอีเมลไม่สำเร็จ:', err.hint);
    throw err;
  }
}

// เทมเพลตแจ้งเตือนก่อนครบกำหนดคืน
function dueDateReminderTemplate(name, bookTitle, dueDate, trackingNo) {
  return `
    <p>สวัสดีคุณ ${name},</p>
    <p>หนังสือ "<b>${bookTitle}</b>" ของคุณใกล้ครบกำหนดคืนในวันที่ <b>${dueDate}</b></p>
    ${trackingNo ? `<p>เลขพัสดุจัดส่ง: ${trackingNo}</p>` : ''}
    <p>กรุณาเตรียมจัดส่งคืนพร้อมแนบหลักฐานภาพถ่ายผ่านระบบก่อนวันครบกำหนด เพื่อรับเงินมัดจำคืนเต็มจำนวน</p>
  `;
}

// เทมเพลตแจ้งว่าพัสดุถูกจัดส่งแล้ว (แยกออกมาจาก dueDateReminderTemplate ที่เคยใช้ปนกันแบบข้อความไม่ตรงเนื้อหา)
function shippedTemplate(name, bookTitle, dueDate, trackingNo) {
  return `
    <p>สวัสดีคุณ ${name},</p>
    <p>พัสดุหนังสือ "<b>${bookTitle}</b>" ของคุณถูกจัดส่งแล้ว</p>
    ${trackingNo ? `<p>เลขพัสดุติดตาม: <b>${trackingNo}</b></p>` : ''}
    <p>กำหนดคืนหนังสือคือวันที่ <b>${dueDate}</b> กรุณาส่งคืนพร้อมแนบหลักฐานภาพถ่ายผ่านระบบก่อนวันครบกำหนด เพื่อรับเงินมัดจำคืนเต็มจำนวน</p>
  `;
}

// เทมเพลตแจ้งว่าได้รับแจ้งคืนหนังสือแล้ว (ลูกค้าอัปโหลดหลักฐานการคืน) กำลังรอแอดมินตรวจสอบ
function returnRequestedTemplate(name, bookTitle) {
  return `
    <p>สวัสดีคุณ ${name},</p>
    <p>ระบบได้รับแจ้งการคืนหนังสือ "<b>${bookTitle}</b>" ของคุณเรียบร้อยแล้ว</p>
    <p>ขณะนี้อยู่ระหว่างรอเจ้าหน้าที่ตรวจสอบหลักฐานการคืน เมื่อตรวจสอบเสร็จสิ้นและอนุมัติแล้ว ระบบจะดำเนินการคืนเงินมัดจำให้คุณ และจะมีอีเมลแจ้งผลอีกครั้ง</p>
  `;
}

const baht = n => Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });

// เทมเพลตแจ้งว่าแอดมินยืนยันการคืนหนังสือแล้ว (ยังไม่ใช่การโอนเงินคืน — ระบบจะแจ้งอีกครั้งเมื่อโอนแล้ว)
function returnConfirmedTemplate(name, bookTitle, depositAmount, lateFee = 0, refundAmount = null, lateDays = 0) {
  const refund = refundAmount === null ? Number(depositAmount) : Number(refundAmount);
  const days = Number(process.env.REFUND_WITHIN_DAYS) || 3;
  return `
    <p>สวัสดีคุณ ${name},</p>
    <p>เจ้าหน้าที่ได้ตรวจสอบและยืนยันการคืนหนังสือ "<b>${bookTitle}</b>" ของคุณเรียบร้อยแล้ว</p>
    <p>ค่ามัดจำ: ${baht(depositAmount)} บาท${Number(lateFee) > 0 ? `<br>หักค่าปรับเกินกำหนดคืน ${lateDays} วัน: ${baht(lateFee)} บาท` : ''}</p>
    ${refund > 0
      ? `<p>ยอดที่จะโอนคืนให้คุณ: <b>${baht(refund)} บาท</b> เราจะโอนเข้าบัญชีที่คุณระบุภายใน ${days} วันทำการ และจะส่งอีเมลแจ้งอีกครั้งเมื่อโอนแล้ว</p>`
      : '<p>ค่าปรับเท่ากับค่ามัดจำ จึงไม่มียอดที่ต้องโอนคืน</p>'}
    <p>ขอบคุณที่ใช้บริการยืมหนังสือกับเรา</p>
  `;
}

// เทมเพลตแจ้งว่าแอดมินโอนเงินมัดจำคืนแล้ว
function refundSentTemplate(name, bookTitle, amount, reference) {
  return `
    <p>สวัสดีคุณ ${name},</p>
    <p>เราได้โอนเงินมัดจำคืนสำหรับหนังสือ "<b>${bookTitle}</b>" จำนวน <b>${baht(amount)} บาท</b> เข้าบัญชีที่คุณระบุเรียบร้อยแล้ว</p>
    ${reference ? `<p>เลขอ้างอิง/หมายเหตุ: ${reference}</p>` : ''}
    <p>หากไม่พบยอดเงินภายใน 1 วันทำการ กรุณาติดต่อเจ้าหน้าที่</p>
  `;
}

// เทมเพลตแจ้งเตือนเมื่อเกินกำหนดคืนแล้ว
function overdueNoticeTemplate(name, bookTitle, dueDate, lateDays, lateFee, feePerDay, deposit) {
  return `
    <p>สวัสดีคุณ ${name},</p>
    <p>หนังสือ "<b>${bookTitle}</b>" เลยกำหนดคืน (${dueDate}) มาแล้ว <b>${lateDays} วัน</b></p>
    <p>ค่าปรับสะสมขณะนี้ <b>${baht(lateFee)} บาท</b> (วันละ ${baht(feePerDay)} บาท) ซึ่งจะหักจากเงินมัดจำของคุณ (ไม่เกิน ${baht(deposit)} บาท)</p>
    <p>กรุณาแจ้งคืนหนังสือผ่านระบบพร้อมแนบหลักฐานโดยเร็วที่สุด ค่าปรับจะหยุดนับตั้งแต่วันที่คุณแจ้งคืนในระบบ</p>
  `;
}

// ป้องกันข้อความที่ผู้ใช้พิมพ์ (ซึ่งใส่ลงในอีเมล HTML) ไม่ให้แทรกโค้ด HTML
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>');

// แจ้งเจ้าหน้าที่ว่ามีข้อความใหม่จากลูกค้า
function contactNotifyTemplate(msg) {
  return `
    <p>มีข้อความใหม่จากลูกค้าผ่านหน้า "ติดต่อเจ้าหน้าที่"</p>
    <p><b>หัวข้อ:</b> ${esc(msg.subject)}<br>
       <b>ชื่อ:</b> ${esc(msg.name)}<br>
       <b>อีเมล:</b> ${esc(msg.email)}${msg.phone ? `<br><b>โทร:</b> ${esc(msg.phone)}` : ''}${msg.borrow_record_id ? `<br><b>รายการยืมเลขที่:</b> ${esc(msg.borrow_record_id)}` : ''}</p>
    <p>${esc(msg.message)}</p>
    <p>ตอบกลับได้ที่หน้าแอดมิน เมนู "ข้อความติดต่อ"</p>
  `;
}

// ตอบรับลูกค้าว่าได้รับข้อความแล้ว
function contactAckTemplate(name, subject) {
  return `
    <p>สวัสดีคุณ ${esc(name)},</p>
    <p>เราได้รับข้อความของคุณเรื่อง "<b>${esc(subject)}</b>" แล้ว เจ้าหน้าที่จะตอบกลับทางอีเมลนี้โดยเร็วที่สุด</p>
    <p>อีเมลนี้ส่งโดยอัตโนมัติ</p>
  `;
}

// เจ้าหน้าที่ตอบกลับลูกค้า
function contactReplyTemplate(name, subject, original, reply) {
  return `
    <p>สวัสดีคุณ ${esc(name)},</p>
    <p>เจ้าหน้าที่ตอบกลับเรื่อง "<b>${esc(subject)}</b>"</p>
    <p style="padding:12px;background:#f3f4f6;border-radius:8px">${esc(reply)}</p>
    <p style="color:#6b7280;font-size:13px">ข้อความเดิมของคุณ: ${esc(original)}</p>
    <p>หากต้องการสอบถามเพิ่มเติม ส่งข้อความใหม่ผ่านหน้า "ติดต่อเจ้าหน้าที่" ได้เลย</p>
  `;
}

module.exports = {
  sendMail,
  isMailConfigured,
  dueDateReminderTemplate,
  shippedTemplate,
  returnRequestedTemplate,
  returnConfirmedTemplate,
  refundSentTemplate,
  overdueNoticeTemplate,
  contactNotifyTemplate,
  contactAckTemplate,
  contactReplyTemplate
};
