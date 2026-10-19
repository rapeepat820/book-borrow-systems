# นำระบบขึ้นออนไลน์ให้คนอื่นทดสอบ (Deploy)

## ก่อนอื่น: เว็บ หรือ แอพ?

ระบบนี้จะกลายเป็น **เว็บไซต์** (มีลิงก์ URL ให้เปิดผ่านเบราว์เซอร์ได้ทุกที่) หน้าตาถูกออกแบบมาแบบ mobile-first
อยู่แล้ว เปิดผ่านมือถือจะรู้สึกเหมือนแอพทั่วไป (มี bottom navigation, การ์ด, ปุ่มขนาดใหญ่ ฯลฯ)

ถ้าหมายถึง "แอพ" แบบที่ต้องโหลดจาก Play Store / App Store ได้ นั่นเป็นงานคนละส่วน ต้องเอาโค้ด React
ไป wrap ด้วยเครื่องมืออย่าง Capacitor หรือเขียนใหม่ด้วย React Native แล้วส่งเข้า store (มีขั้นตอนสมัคร
นักพัฒนา + ค่าธรรมเนียม + กระบวนการรีวิว) ซึ่งเกินขอบเขตของโปรเจกต์นี้ — **แนะนำให้ทำเป็นเว็บไซต์ตามที่
proposal ระบุไว้ (Railway.app)** ก็เพียงพอสำหรับให้อาจารย์/เพื่อนเปิดลิงก์เข้ามาทดสอบได้แล้ว

---

## ภาพรวมสถาปัตยกรรมตอน deploy

ผมปรับโค้ดให้ **backend เสิร์ฟหน้าเว็บ frontend ที่ build แล้วในตัว** ดังนั้นตอน deploy จริง จะมีแค่
**service เดียว** (ไม่ต้องแยก hosting 2 ที่ ไม่ต้องกังวลเรื่อง CORS หรือโดเมนคนละอันกับรูปภาพที่อัปโหลด)
คนอื่นเปิดลิงก์เดียว ได้ทั้งเว็บและ API ในโดเมนเดียวกัน

```
คนใช้งาน → https://your-app.up.railway.app
              │
              ├─ "/"       → เสิร์ฟหน้าเว็บ React (frontend/dist)
              ├─ "/api/*"  → เรียก backend Express
              └─ "/uploads/*" → รูปสลิป/หลักฐานการคืนที่อัปโหลด
```

---

## ขั้นตอนที่ 1: เตรียมโค้ดขึ้น GitHub

Railway ดึงโค้ดจาก GitHub มา deploy ให้อัตโนมัติทุกครั้งที่ push ใหม่

1. สร้างบัญชี GitHub (ถ้ายังไม่มี) ที่ https://github.com
2. สร้าง repository ใหม่ (กด "New repository") ตั้งชื่อ เช่น `book-borrow-system` — เลือก Private ก็ได้
3. เปิด Terminal ไปที่โฟลเดอร์โปรเจกต์ (โฟลเดอร์ที่แตกจาก zip นี้) แล้วรัน:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/<ชื่อบัญชีคุณ>/book-borrow-system.git
   git push -u origin main
   ```
   > ถ้าเครื่องยังไม่มี git ให้ติดตั้งก่อนที่ https://git-scm.com

---

## ขั้นตอนที่ 2: สมัคร Railway และสร้างฐานข้อมูล MySQL

1. ไปที่ https://railway.app → สมัคร/เข้าสู่ระบบด้วยบัญชี GitHub
2. กด **New Project** → **Provision MySQL** (หรือ "Add MySQL" จาก template)
3. รอสักครู่ Railway จะสร้างฐานข้อมูล MySQL ให้พร้อม credentials อัตโนมัติ
4. คลิกเข้าไปที่ MySQL service → แท็บ **Data** หรือ **Query** จะมีช่องให้รัน SQL ได้ตรงๆ
   → เปิดไฟล์ `backend/database/schema.sql` ก็อปทั้งไฟล์ วางแล้วรัน เพื่อสร้างตาราง+ข้อมูลตัวอย่าง
   (หรือใช้โปรแกรม MySQL client เช่น TablePlus/MySQL Workbench เชื่อมต่อด้วย host/port/user/password
   ที่อยู่ในแท็บ **Connect** ของ Railway ก็ได้)
5. อย่าลืมสร้างรหัสผ่านแอดมินจริง (แทนที่ `password_hash` ตัวอย่างในตาราง `users`) เหมือนขั้นตอนตอน
   ทดสอบ local — ดูวิธีได้ใน `HOW_TO_RUN.md` ขั้นตอนที่ 3 (รันคำสั่ง `node -e "console.log(require('bcrypt').hashSync(...))"` บนเครื่องตัวเองแล้วเอา hash ไปแทนที่ในตาราง users ผ่าน Railway Query tab)

---

## ขั้นตอนที่ 3: Deploy service (backend + frontend รวมเป็นอันเดียว)

1. ในโปรเจกต์ Railway เดิม กด **New** → **GitHub Repo** → เลือก repo `book-borrow-system` ที่เพิ่ง push
2. Railway จะเจอไฟล์ `package.json` ที่ root ของโปรเจกต์อัตโนมัติ และรัน:
   - Build: `npm run build` (ซึ่ง script นี้จะ `npm install` ทั้ง backend และ frontend แล้ว build frontend ให้)
   - Start: `npm start` (รัน backend ซึ่งตอนนี้จะเสิร์ฟหน้าเว็บที่ build ไว้ด้วย)
3. ไปที่แท็บ **Variables** ของ service นี้ ใส่ environment variables ตามนี้:
   ```
   DB_HOST=<ค่าจาก MySQL service ของ Railway>
   DB_USER=<ค่าจาก MySQL service ของ Railway>
   DB_PASSWORD=<ค่าจาก MySQL service ของ Railway>
   DB_NAME=<ค่าจาก MySQL service ของ Railway>
   JWT_SECRET=<ตั้งข้อความสุ่มยาวๆ อะไรก็ได้>
   SMTP_USER=<อีเมล Gmail ถ้าต้องการให้ส่งอีเมลจริง>
   SMTP_PASS=<Gmail App Password>
   FRONTEND_URL=<ใส่หลัง deploy เสร็จแล้ว ได้โดเมนมา — ดูขั้นตอนที่ 4>
   CLOUDINARY_CLOUD_NAME=<จากบัญชี Cloudinary ฟรี — ดูขั้นตอนที่ 3.5>
   CLOUDINARY_API_KEY=<จากบัญชี Cloudinary ฟรี>
   CLOUDINARY_API_SECRET=<จากบัญชี Cloudinary ฟรี>
   ```
   💡 Railway มีปุ่ม **"Reference Variable"** ให้ดึงค่าจาก MySQL service มาใส่ตรงนี้ได้เลยโดยไม่ต้อง
   copy-paste เอง (เลือก service MySQL แล้วเลือกตัวแปรที่ต้องการ)
4. กด Deploy รอสักครู่ Railway จะ build และรันให้อัตโนมัติ

### ขั้นตอนที่ 3.5: ตั้งค่า Cloudinary (สำคัญมากสำหรับใช้งานจริง)

รูปสลิปโอนเงินและหลักฐานการคืนหนังสือที่ผู้ใช้อัปโหลด **ต้องเก็บไว้แบบถาวร** ไม่งั้นจะหายทุกครั้งที่ Railway
redeploy service (พื้นที่เก็บไฟล์ของ Railway เป็นแบบชั่วคราว) วิธีแก้คือใช้บริการเก็บรูปภาพฟรีอย่าง Cloudinary:

1. สมัครบัญชีฟรีที่ https://cloudinary.com (ฟรี 25GB ต่อเดือน เพียงพอสำหรับการใช้งานจริงระดับเล็ก-กลาง)
2. หลังสมัครเสร็จ จะเห็นหน้า Dashboard มีค่า **Cloud Name**, **API Key**, **API Secret** อยู่ด้านบน
3. คัดลอกค่าทั้ง 3 ไปใส่ในตัวแปร `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   ที่ Railway (ในขั้นตอนที่ 3 ด้านบน)
4. ระบบจะสลับไปใช้ Cloudinary เก็บรูปโดยอัตโนมัติทันทีที่ตั้งค่าครบ (ไม่ต้องแก้โค้ดเพิ่ม) — ถ้าไม่ตั้งค่า
   ระบบจะ fallback ไปเก็บไฟล์ในดิสก์ของเครื่อง (ใช้ได้แค่ตอน dev บนเครื่องตัวเอง ไม่เหมาะกับ production)

---

## ขั้นตอนที่ 4: เอาโดเมนสาธารณะมาแชร์

1. ไปที่แท็บ **Settings** ของ service → หัวข้อ **Networking** → กด **Generate Domain**
2. จะได้ลิงก์แบบ `https://xxxx.up.railway.app` — นี่คือลิงก์ที่แชร์ให้คนอื่นเปิดทดสอบได้เลย
3. กลับไปที่ **Variables** → แก้ `FRONTEND_URL` ให้เป็นลิงก์นี้ (ใช้สำหรับสร้างลิงก์ในอีเมล "ลืมรหัสผ่าน")
   แล้วกด redeploy อีกครั้ง

ทดสอบ:
- หน้าลูกค้า: `https://xxxx.up.railway.app`
- หน้าแอดมิน: `https://xxxx.up.railway.app/admin/login`

---

## ข้อควรรู้ก่อนให้คนอื่นทดสอบ

- **QR PromptPay เป็นรูปคงที่รูปเดียว = เงินโอนจริงเข้าบัญชีในรูปนั้นเสมอ** ระบบไม่ได้สร้าง QR ใหม่ต่อรายการอีกต่อไป
  แต่ใช้ QR รูปเดียวที่ฝังไว้ในโค้ด (`frontend/src/assets/promptpay-qr.png` + ชื่อบัญชีที่ `frontend/src/config/payment.js`)
  ถ้าเป็น QR ของบัญชีจริง คนที่สแกนแล้วโอนเงินจะเข้าบัญชีนั้นจริง — ถ้าแค่อยากให้คนอื่นทดสอบหน้าตาระบบโดยไม่ให้เกิด
  การโอนเงินจริง ให้เปลี่ยนไฟล์รูป QR เป็น QR ปลอม/ของทดสอบก่อน deploy เพราะ QR นี้ไม่ได้ฝังยอดเงินไว้อัตโนมัติ
  ผู้โอนต้องกรอกยอดเงินเองตามที่แอพแสดงไว้
- **รูปที่อัปโหลด (สลิป/หลักฐานการคืน)** ถ้าตั้งค่า Cloudinary ตามขั้นตอนที่ 3.5 แล้ว จะเก็บถาวรไม่หายแม้ redeploy
  — ถ้าข้ามขั้นตอนนี้ไป รูปจะหายทุกครั้งที่ redeploy เพราะ Railway ใช้พื้นที่เก็บไฟล์แบบชั่วคราว (ephemeral)
- **การป้องกันการโจมตี**: ระบบมี rate limit (จำกัดจำนวนครั้ง) ที่หน้า login/สมัครสมาชิก/ลืมรหัสผ่านแล้ว
  (สูงสุด 20 ครั้ง/15 นาที ต่อ IP) และมี security headers พื้นฐาน (helmet) ป้องกันการโจมตีทั่วไป
- **ข้อมูลส่วนบุคคล**: ระบบเก็บชื่อ/เบอร์โทร/ที่อยู่ของผู้ใช้จริง มีหน้า "นโยบายความเป็นส่วนตัว" ให้ผู้ใช้
  ยอมรับตอนสมัครแล้ว (เป็นแค่ template เบื้องต้น ไม่ใช่คำแนะนำทางกฎหมาย) หากเปิดให้คนทั่วไปใช้งานจริง
  ในวงกว้าง ควรปรึกษาผู้เชี่ยวชาญด้านกฎหมายเรื่อง PDPA เพิ่มเติม
- **อีเมล**: ถ้าไม่ตั้งค่า `SMTP_USER`/`SMTP_PASS` ระบบจะไม่ส่งอีเมลจริง (แค่ log ไว้ใน Railway logs)
  ถ้าอยากให้ลืมรหัสผ่าน/แจ้งเตือนทำงานจริง ต้องตั้งค่า SMTP ให้ครบ (แนะนำ Gmail App Password)
- **ฐานข้อมูลตัวอย่าง**: อย่าลืม DROP + import schema.sql ใหม่ทุกครั้งถ้าแก้โครงสร้างตารางระหว่างพัฒนา
  (เหมือนตอนทดสอบ local)

ดูรายการตรวจสอบเพิ่มเติมก่อนเปิดให้คนทั่วไปใช้งานจริงได้ที่ [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md)

---

## ทางเลือกอื่น (ถ้าไม่อยากใช้ Railway ทั้งหมด)

ถ้าอยากได้ frontend ที่โหลดเร็วขึ้นผ่าน CDN ระดับโลก สามารถแยก deploy frontend ไปที่ **Vercel**
(ฟรี, เหมาะกับ React/Vite) และให้ backend + MySQL อยู่ที่ Railway เหมือนเดิมได้ แต่จะต้องทำเพิ่ม:
- ตั้งค่า `VITE_API_BASE_URL` ตอน build frontend ให้ชี้ไปที่โดเมน backend บน Railway
- แก้ URL รูปภาพที่มาจาก `/uploads/...` ให้ต่อ domain ของ backend เข้าไปด้วย (ไม่งั้นรูปจะไม่ขึ้นเพราะอยู่
  คนละโดเมนกับ frontend)

วิธีนี้ซับซ้อนกว่า จึงแนะนำให้เริ่มจากวิธี Railway-only (service เดียว) ด้านบนก่อน ถ้าใช้งานได้ดีแล้ว
ค่อยพิจารณาแยกทีหลังได้
