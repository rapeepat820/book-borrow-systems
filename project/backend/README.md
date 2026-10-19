# ระบบยืม-คืนหนังสือออนไลน์ (ร้านหนังสือทั่วไป)

โปรเจกต์นี้พัฒนาตาม Proposal วิชาปัญหาพิเศษ 02739498 โดยใช้:

- **Backend:** Node.js + Express
- **Frontend:** React + CSS (Vite)
- **Database:** MySQL
- **แจ้งเตือน:** Email ผ่าน Nodemailer (+ cron รายวันแจ้งเตือนก่อนครบกำหนดคืน)
- **Hosting ต้นแบบ:** Railway.app (backend + MySQL) / Vercel หรือ Railway (frontend)

## ฟีเจอร์ที่เพิ่มเติมตามที่ขอ

| # | ฟีเจอร์ | จุดที่ implement |
|---|---------|------------------|
| 1 | ระยะเวลาจัดส่งมีผลต่อระยะเวลายืม-คืน | `backend/utils/calcBorrow.js` → `calcDueDate()` บวกวันจัดส่ง (ไป+กลับ) เข้ากับจำนวนวันยืมของประเภทหนังสือ |
| 2 | จัดเก็บ tracking no. | ตาราง `borrow_records.tracking_no`, แอดมินกรอกผ่านหน้า "รายการยืม-คืน" (`PUT /api/admin/borrow-records/:id/ship`) |
| 3 | แนบหลักฐานการคืน (ภาพถ่าย) | อัปโหลดผ่าน Multer (`backend/middleware/upload.js`), ลูกค้าแนบที่หน้า "รายการยืมของฉัน" (`POST /api/borrow/:id/return`) |
| 4 | ระยะเวลายืมแปรผันตามประเภทหนังสือ | ตาราง `book_types.borrow_days` กำหนดได้จากหน้าแอดมิน "ประเภทหนังสือ" |
| 5 | คิดค่าจัดส่งจากบริษัทต้นแบบ | ตาราง `shipping_companies` (ตั้งต้นแบบไว้ 2 บริษัท: Kerry Express / ไปรษณีย์ไทย EMS — จำกัดตัวเลือกให้เลือกง่าย) สูตร `base_fee + fee_per_book × จำนวนเล่ม` เพิ่ม/แก้ไข/ปิดใช้งานบริษัทได้ที่หน้าแอดมิน "บริษัทขนส่ง" |
| 6 | ค่ามัดจำป้องกันหนังสือชำรุด | ตาราง `book_types.deposit_amount` (ค่ามัดจำมาตรฐานต่อประเภท) ระบบจะเลือกค่าที่สูงกว่าระหว่างค่ามัดจำมาตรฐานกับมูลค่าหนังสือ (`calcDeposit()`), แอดมินกดคืนเงินมัดจำหลังตรวจหลักฐานคืนผ่าน "ยืนยันคืน + คืนมัดจำ" |

หน้าเว็บหลัก: **Login, Register, Home** ตามที่ระบุ พร้อมหน้าเสริมที่ออกแบบให้ตรงกับ Figma wireframe ที่แนบมา:

**ฝั่งลูกค้า (มี bottom navigation 4 แท็บ: หน้าแรก / หนังสือของฉัน / ประวัติ / โปรไฟล์):**
Login, Register, ลืมรหัสผ่าน, สร้างรหัสผ่านใหม่, Home (ค้นหาหนังสือ), รายละเอียดหนังสือ, ยืนยันการยืม, ยืมสำเร็จ, หนังสือของฉัน (MyBook), ประวัติการยืม (History), โปรไฟล์, เมนู/ตั้งค่า (แก้ไขโปรไฟล์ / เปลี่ยนรหัสผ่าน / ข้อกำหนดและเงื่อนไข / ออกจากระบบ), คืนหนังสือ (แนบรูปหลักฐาน), ขอต่ออายุยืม + หน้ายืนยัน

**ฝั่งแอดมิน (sidebar 4 เมนู: Dashboard / คลังหนังสือ / สมาชิก / การยืม-คืน):**
เข้าสู่ระบบ admin แยกต่างหาก, Dashboard (สถิติ + รายการล่าสุด), คลังหนังสือ (แท็บย่อย: รายการหนังสือ / ประเภทหนังสือ / บริษัทขนส่ง), รายชื่อลูกค้า (ค้นหา + เพิ่มลูกค้า), รายการยืม-คืน (เพิ่มรายการใหม่ให้ลูกค้าที่ติดต่อทางร้าน, บันทึกเลข tracking, อนุมัติ/ปฏิเสธคำขอต่ออายุยืม, ยืนยันคืน + คืนมัดจำ)

## ฟีเจอร์เสริมตามดีไซน์ที่ส่งมา

- **ลืมรหัสผ่าน / สร้างรหัสผ่านใหม่:** ส่งลิงก์ผ่านอีเมล (Nodemailer) พร้อม token หมดอายุใน 1 ชั่วโมง (`/api/auth/forgot-password`, `/api/auth/reset-password`)
- **เปลี่ยนรหัสผ่าน (ในเมนู):** ต้องยืนยันรหัสผ่านเดิมก่อน (`/api/auth/change-password`)
- **แก้ไขโปรไฟล์:** ชื่อ/เบอร์โทร/ที่อยู่จัดส่ง (`/api/auth/me`)
- **ขอต่ออายุยืม (ยืดเวลาคืน) แบบมีค่าธรรมเนียม:** ลูกค้าส่งคำขอ +3/+7/+14 วัน ระบบคิดค่าธรรมเนียมต่ออายุ 5 บาท/วัน (`calcExtendFee()` ใน `backend/utils/calcBorrow.js`) ต้องสแกน QR PromptPay จ่ายค่าธรรมเนียมแล้วแนบสลิปก่อน (`POST /api/borrow/:id/extend-request` → `GET /api/borrow/:id/extend-payment-qr` → `POST /api/borrow/:id/extend-payment-slip`) แอดมินตรวจสลิปแล้วระบบจะบวกวันเข้ากำหนดคืนให้อัตโนมัติทันทีที่ยืนยัน (`PUT /api/admin/borrow-records/:id/verify-extend-payment`) หรือปฏิเสธคำขอได้ที่ `PUT /api/admin/borrow-records/:id/resolve-extend`
- **แอดมินเพิ่มลูกค้า/รายการยืมเอง:** รองรับกรณีลูกค้าติดต่อทางร้านโดยตรง (`POST /api/admin/members`, `POST /api/admin/borrow-records`)
- **ที่อยู่จัดส่งแบบ dropdown ผูกกับโปรไฟล์:** ตอนสมัครสมาชิก/แก้ไขโปรไฟล์ ลูกค้าเลือกที่อยู่ผ่าน dropdown จังหวัด → อำเภอ/เขต → ตำบล/แขวง (เติมรหัสไปรษณีย์ให้อัตโนมัติ, ข้อมูลครบทั้ง 77 จังหวัด) แทนการพิมพ์ที่อยู่แบบข้อความอิสระ (`frontend/src/components/AddressSelect.jsx`, `frontend/src/data/thaiAddress.json`) ระบบประกอบเป็นที่อยู่แบบเต็มเก็บไว้ที่โปรไฟล์ (`users.address` + ฟิลด์ย่อย `address_detail/subdistrict/district/province/postal_code`) ตอนยืมหนังสือจะ**ดึงที่อยู่จากโปรไฟล์มาใช้จัดส่งอัตโนมัติทันที ไม่ต้องกรอกซ้ำ** — ถ้ายังไม่มีที่อยู่ในโปรไฟล์ระบบจะพาไปตั้งค่าที่หน้าแก้ไขโปรไฟล์ก่อน แอดมินดูที่อยู่เต็มของแต่ละรายการได้ที่หน้า "รายการยืม-คืน" ปุ่ม "ดูที่อยู่จัดส่ง" เหมือนเดิม
- **รูปปกหนังสือ + หมวดหมู่แบบมีรูป:** ทุกเล่มมีปกที่ระบบสร้างให้อัตโนมัติ (gradient + ชื่อเรื่อง) หากยังไม่มีรูปจริง และหน้า Home มีการ์ดหมวดหมู่แบบมีภาพให้กดกรองได้ (`frontend/src/components/BookCover.jsx`, `frontend/src/utils/coverArt.js`)
- **ติดตามสถานะพัสดุแบบละเอียด:** ผู้ยืมตรวจสอบได้ว่าออเดอร์อยู่ขั้นตอนไหน (กำลังแพ็คสินค้า → กำลังจัดส่ง → ขนส่งกำลังนำส่ง → จัดส่งสำเร็จ) ผ่านหน้า "ติดตามพัสดุ" แบบ stepper พร้อมเลข tracking และลิงก์ไปเช็คกับเว็บขนส่งโดยตรง แอดมินอัปเดตสถานะได้ที่หน้า "รายการยืม-คืน" (`borrow_records.shipping_status`, `PUT /api/admin/borrow-records/:id/shipping-status`)
- **ชำระค่ามัดจำ + ค่าจัดส่งผ่าน PromptPay QR พร้อมแนบสลิป:** ตอนยืนยันการยืม ระบบสร้างรายการยืม (สถานะรอชำระเงิน) แล้วให้สแกน QR PromptPay แบบรูปคงที่รูปเดียว (ไม่ได้สร้าง QR ใหม่ต่อรายการ) พร้อมแสดงยอดที่ต้องจ่ายและชื่อบัญชีผู้รับเงินให้ตรวจสอบก่อนโอน จากนั้น**ต้องแนบรูปสลิปการโอนเงิน**ก่อนจึงจะถือว่ายืมสำเร็จ — รายการจะเข้าสถานะ "รอตรวจสอบสลิป" จนกว่าแอดมินจะกดยืนยัน/ปฏิเสธที่หน้า "รายการยืม-คืน" (`frontend/src/config/payment.js` ตั้งค่ารูป QR/ชื่อบัญชี, `POST /api/borrow/:id/payment-slip`, `PUT /api/admin/borrow-records/:id/verify-payment`)
- **ทดสอบอีเมลแจ้งเตือนใกล้ครบกำหนดคืนได้ทันที:** ปกติระบบส่งอัตโนมัติทุกวัน 08:00 น. แต่มีปุ่ม "ส่งอีเมลแจ้งเตือนตอนนี้" ในหน้า Dashboard ของแอดมิน ให้กดทดสอบได้โดยไม่ต้องรอ (`POST /api/admin/send-due-reminders`)

> **วิธีเปิดใช้งานจริงเพื่อทดสอบ:** ดูคู่มือละเอียดทีละขั้นตอนได้ที่ [`HOW_TO_RUN.md`](./HOW_TO_RUN.md) (ครอบคลุมตั้งแต่ติดตั้ง MySQL/Node.js, ตั้งค่า PromptPay ไปจนถึงวิธีทดสอบ flow ยืม-คืนแบบครบวงจร)
>
> **วิธีเอาขึ้นออนไลน์ให้คนอื่นทดสอบ:** ดูคู่มือได้ที่ [`DEPLOY.md`](./DEPLOY.md) (deploy เป็นเว็บไซต์ผ่าน Railway.app service เดียว ตามที่ระบุใน proposal)
>
> **วิธีเตรียมตัวก่อนเปิดให้บุคคลทั่วไปใช้งานจริง:** ดู checklist ที่ [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md)

## โครงสร้างโปรเจกต์

```
project/
├── backend/                  # Node.js + Express API
│   ├── config/db.js          # เชื่อมต่อ MySQL
│   ├── database/schema.sql   # โครงสร้างฐานข้อมูล + ข้อมูลตัวอย่าง
│   ├── middleware/           # auth (JWT), upload (multer)
│   ├── routes/                # auth, books, borrow, admin
│   ├── utils/                 # mailer, calcBorrow (สูตรคำนวณหลัก), reminderCron
│   ├── uploads/return-proofs/ # ไฟล์ภาพหลักฐานการคืน
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── frontend/                  # React + Vite + CSS
    ├── src/
    │   ├── pages/               # Login, Register, ForgotPassword, ResetPassword, Home,
    │   │                        # BookDetail, Borrow, BorrowSuccess, MyBook, History,
    │   │                        # Profile, Menu, EditProfile, ChangePassword, Terms,
    │   │                        # ReturnBook, RequestExtend, ExtendConfirmed
    │   ├── pages/admin/          # AdminLogin, AdminLayout, AdminDashboard, AdminInventory
    │   │                        # (tabs: AdminBooks / AdminBookTypes / AdminShipping),
    │   │                        # AdminMembers, AdminBorrowRecords
    │   ├── components/          # CustomerLayout, BottomNav, Logo, Icons, ProtectedRoute, BarChartDecoration
    │   ├── api.js               # เรียก backend API ทั้งหมดจากจุดเดียว
    │   └── styles/index.css     # ธีมสี "RP Bookstore" (โทนน้ำเงิน) ตาม Figma wireframe
    ├── vite.config.js
    └── package.json
```

## วิธีติดตั้งและรัน (Local)

### 1) ฐานข้อมูล
```bash
mysql -u root -p < backend/database/schema.sql
```

### 2) Backend
```bash
cd backend
cp .env.example .env      # แก้ค่า DB_*, JWT_SECRET, SMTP_* ให้ตรงกับเครื่องของคุณ
npm install
npm run dev                # รันที่ http://localhost:4000
```
> หมายเหตุ: ผู้ใช้ admin ตัวอย่างใน schema.sql ใช้ password hash ตัวอย่าง (`replace_with_bcrypt_hash`)
> ให้สร้าง hash จริงด้วย `node -e "console.log(require('bcrypt').hashSync('yourpassword',10))"`
> แล้วนำไปแทนที่ในตาราง `users` ก่อนใช้งานจริง — จากนั้นเข้าสู่ระบบแอดมินได้ที่หน้า `/admin/login`
> (แยกจากหน้า `/login` ของลูกค้า แต่ใช้ email/password เดียวกับที่ตั้งไว้ในตาราง users)

### 3) Frontend
```bash
cd frontend
npm install
npm run dev                # รันที่ http://localhost:5173 (proxy ไป backend อัตโนมัติ)
```

## Deploy ต้นแบบ (ตาม Proposal)
- **Backend + MySQL:** Railway.app — สร้าง MySQL plugin แล้วตั้งค่า env ตาม `.env.example`, import `schema.sql`
- **Frontend:** Railway.app หรือ Vercel — ตั้งค่า `VITE`/proxy หรือ environment ให้ frontend เรียก URL ของ backend ที่ deploy จริง

## หมายเหตุเรื่องการออกแบบ (อ้างอิง Figma Wireframe)
ไฟล์นี้ implement ตามหน้าหลักที่ระบุ (Login / Register / Home) และหน้าที่จำเป็นต่อการยืม-คืนและหน้า Admin ครบถ้วน
โครงสร้างสีและ layout ใน `src/styles/index.css` ออกแบบให้เรียบง่าย ปรับสี/ฟอนต์/องค์ประกอบเพิ่มเติมให้ตรงกับ
Figma wireframe ที่แนบมาได้โดยแก้ที่ไฟล์ CSS และ JSX ของแต่ละหน้าโดยตรง (ไม่กระทบ backend/logic)
