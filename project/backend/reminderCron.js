const cron = require('node-cron');
const pool = require('../config/db');
const { sendMail, dueDateReminderTemplate, overdueNoticeTemplate } = require('./mailer');
const { LATE_DAYS_SQL, attachLateInfo } = require('./calcBorrow');

// ค้นหารายการที่ใกล้ครบกำหนดคืนใน 2 วันข้างหน้า แล้วส่งอีเมลแจ้งเตือน
// แยกออกมาเป็นฟังก์ชันเดี่ยวๆ เพื่อให้ (1) cron รายวันเรียกใช้ และ (2) แอดมินกดสั่งส่งเองตอนทดสอบได้ด้วย
async function sendDueReminders() {
  const [rows] = await pool.query(
    `SELECT br.*, b.title, u.full_name, u.email
     FROM borrow_records br
     JOIN books b ON br.book_id = b.id
     JOIN users u ON br.user_id = u.id
     WHERE br.status = 'borrowing'
       AND br.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 2 DAY)`
  );
  for (const r of rows) {
    await sendMail(r.email, 'แจ้งเตือน: ใกล้ครบกำหนดคืนหนังสือ',
      dueDateReminderTemplate(r.full_name, r.title, r.due_date, r.tracking_no));
  }
  console.log(`[reminderCron] ส่งอีเมลแจ้งเตือนแล้ว ${rows.length} รายการ`);
  return rows.length;
}

// ส่งอีเมลเตือน "เกินกำหนดคืนแล้ว" พร้อมค่าปรับสะสม — ส่งซ้ำได้ทุก 3 วัน ไม่รัวทุกวัน
// อัปเดต last_overdue_notice เฉพาะเมื่อส่งสำเร็จจริง (ถ้ายังไม่ได้ตั้งค่าอีเมล จะลองใหม่ในรอบถัดไป)
async function sendOverdueNotices() {
  const [rows] = await pool.query(
    `SELECT br.*, ${LATE_DAYS_SQL}, b.title, u.full_name, u.email
     FROM borrow_records br
     JOIN books b ON br.book_id = b.id
     JOIN users u ON br.user_id = u.id
     WHERE br.status = 'borrowing' AND br.due_date < CURDATE()
       AND (br.last_overdue_notice IS NULL OR DATEDIFF(CURDATE(), br.last_overdue_notice) >= 3)`
  );
  let sent = 0;
  for (const raw of rows) {
    const r = attachLateInfo(raw);
    try {
      const ok = await sendMail(r.email, 'แจ้งเตือน: หนังสือเกินกำหนดคืนแล้ว',
        overdueNoticeTemplate(r.full_name, r.title, String(r.due_date).slice(0, 10), r.late_days || raw.late_days_raw,
          r.late_fee_due, r.late_fee_per_day, r.deposit_amount));
      if (ok) {
        await pool.query('UPDATE borrow_records SET last_overdue_notice = CURDATE() WHERE id = ?', [r.id]);
        sent++;
      }
    } catch (err) {
      console.error('[reminderCron] overdue notice error:', err.message);
    }
  }
  console.log(`[reminderCron] ส่งอีเมลเตือนเกินกำหนดแล้ว ${sent}/${rows.length} รายการ`);
  return sent;
}

// รันทุกวัน (เวลาไทย): 08:00 แจ้งเตือนใกล้ครบกำหนดใน 2 วันข้างหน้า, 08:05 แจ้งเตือนรายการที่เกินกำหนดแล้ว
function startReminderCron() {
  const opts = { timezone: 'Asia/Bangkok' };
  cron.schedule('0 8 * * *', async () => {
    try {
      await sendDueReminders();
    } catch (err) {
      console.error('[reminderCron] error:', err);
    }
  }, opts);
  cron.schedule('5 8 * * *', async () => {
    try {
      await sendOverdueNotices();
    } catch (err) {
      console.error('[reminderCron] overdue error:', err);
    }
  }, opts);
}

module.exports = { startReminderCron, sendDueReminders, sendOverdueNotices };
