const cron = require('node-cron');
const pool = require('../config/db');
const { sendMail, dueDateReminderTemplate } = require('./mailer');

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

// รันทุกวันเวลา 08:00 น. แจ้งเตือนลูกค้าที่ใกล้ครบกำหนดคืนใน 2 วันข้างหน้า
function startReminderCron() {
  cron.schedule('0 8 * * *', async () => {
    try {
      await sendDueReminders();
    } catch (err) {
      console.error('[reminderCron] error:', err);
    }
  });
}

module.exports = { startReminderCron, sendDueReminders };
