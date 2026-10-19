# ตัวช่วยติดตั้งและเปิดระบบยืม-คืนหนังสือบน Windows ในคลิกเดียว
# ทำให้: หา MySQL -> นำเข้าฐานข้อมูล (ถ้ายังไม่มี) -> สร้าง .env -> npm install -> เปิด backend + frontend + เบราว์เซอร์
$ErrorActionPreference = 'Stop'
function Say($m, $c = 'Cyan') { Write-Host $m -ForegroundColor $c }
function Fail($m) { Say "`n[ผิดพลาด] $m" 'Red'; Read-Host "`nกด Enter เพื่อปิดหน้าต่าง"; exit 1 }

# ---------- 0) หาโฟลเดอร์โปรเจกต์ (ที่มี backend + frontend) ----------
$root = $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'backend\server.js'))) {
  $found = Get-ChildItem -Path $root -Recurse -Filter server.js -Depth 3 -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\backend\\server\.js$' } | Select-Object -First 1
  if (-not $found) { Fail "หาโฟลเดอร์ backend ไม่เจอ กรุณาวางไฟล์นี้ไว้ในโฟลเดอร์ project ที่มี backend และ frontend" }
  $root = $found.Directory.Parent.FullName
}
Say "โฟลเดอร์โปรเจกต์: $root" 'Green'
$backend = Join-Path $root 'backend'; $frontend = Join-Path $root 'frontend'

# ---------- 1) ตรวจ Node.js ----------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "ยังไม่ได้ติดตั้ง Node.js (ต้องเวอร์ชัน 18 ขึ้นไป) ดาวน์โหลดที่ https://nodejs.org แล้วรันไฟล์นี้ใหม่" }
$nodeMajor = [int]((node -v) -replace '^v(\d+).*', '$1')
if ($nodeMajor -lt 18) { Fail "Node.js เวอร์ชัน $(node -v) เก่าเกินไป ต้อง 18 ขึ้นไป ดาวน์โหลดใหม่ที่ https://nodejs.org" }
Say "Node.js $(node -v) ✓" 'Green'

# ---------- 2) หา mysql.exe ----------
$mysql = (Get-Command mysql -ErrorAction SilentlyContinue).Source
if (-not $mysql) {
  $patterns = @('C:\xampp\mysql\bin\mysql.exe', 'C:\Program Files\MySQL\*\bin\mysql.exe', 'C:\Program Files\MariaDB*\bin\mysql.exe', 'C:\wamp64\bin\mysql\*\bin\mysql.exe', 'C:\laragon\bin\mysql\*\bin\mysql.exe')
  foreach ($p in $patterns) { $hit = Get-ChildItem $p -ErrorAction SilentlyContinue | Select-Object -First 1; if ($hit) { $mysql = $hit.FullName; break } }
}
if (-not $mysql) { Fail "หา MySQL ไม่เจอ ให้ติดตั้ง XAMPP (https://www.apachefriends.org) แล้วเปิด XAMPP Control Panel กด Start ที่ MySQL จากนั้นรันไฟล์นี้ใหม่" }
Say "MySQL: $mysql ✓" 'Green'

# ---------- 3) ลองเชื่อมต่อ (รหัสผ่านว่างก่อน ถ้าไม่ได้ค่อยถาม) ----------
$env:MYSQL_PWD = ''
$ok = $false
try { & $mysql -uroot -e "SELECT 1" 2>$null | Out-Null; $ok = ($LASTEXITCODE -eq 0) } catch { $ok = $false }
if (-not $ok) {
  $sec = Read-Host "ใส่รหัสผ่าน MySQL ของ root (ถ้า MySQL ยังไม่เปิด ให้เปิดก่อนแล้วรันใหม่)" -AsSecureString
  $env:MYSQL_PWD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  try { & $mysql -uroot -e "SELECT 1" 2>$null | Out-Null; $ok = ($LASTEXITCODE -eq 0) } catch { $ok = $false }
  if (-not $ok) { Fail "เชื่อมต่อ MySQL ไม่ได้ ตรวจว่า MySQL เปิดอยู่ (XAMPP กด Start) และรหัสผ่านถูกต้อง" }
}
$dbPassword = $env:MYSQL_PWD
Say "เชื่อมต่อ MySQL ได้ ✓" 'Green'

# ---------- 4) นำเข้าฐานข้อมูล (ข้ามถ้ามีอยู่แล้ว เพื่อไม่ทับข้อมูลเดิม) ----------
function Import-Sql($file) {
  # ส่งไฟล์เข้า stdin ของ mysql โดยตรง (แทน "<" ที่ PowerShell ไม่รองรับ) ภาษาไทยไม่เพี้ยน
  $p = Start-Process -FilePath $mysql -ArgumentList '-uroot', '--default-character-set=utf8mb4' `
        -RedirectStandardInput $file -NoNewWindow -Wait -PassThru
  if ($p.ExitCode -ne 0) { Fail "นำเข้าไฟล์ $file ไม่สำเร็จ (รหัส $($p.ExitCode))" }
}
$hasTable = & $mysql -uroot -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='book_borrow_system' AND table_name='books'"
if ($hasTable -match '^[1-9]') {
  Say "พบฐานข้อมูล book_borrow_system อยู่แล้ว — ข้ามขั้นนำเข้า (ข้อมูลเดิมไม่ถูกแตะ)" 'Yellow'
} else {
  Say "กำลังสร้างฐานข้อมูลและนำเข้าข้อมูลหนังสือ..."
  Import-Sql (Join-Path $backend 'database\schema.sql')
  Import-Sql (Join-Path $backend 'database\migration_v5_real_books.sql')
  Say "นำเข้าฐานข้อมูลสำเร็จ ✓" 'Green'
}

# ---------- 5) สร้าง/อัปเดตไฟล์ .env ----------
$envFile = Join-Path $backend '.env'
if (-not (Test-Path $envFile)) { Copy-Item (Join-Path $backend '.env.example') $envFile }
$lines = Get-Content $envFile -Encoding UTF8
$lines = $lines | ForEach-Object { if ($_ -match '^DB_PASSWORD=') { "DB_PASSWORD=$dbPassword" } else { $_ } }
[IO.File]::WriteAllLines($envFile, $lines, (New-Object Text.UTF8Encoding($false)))
Say "ตั้งค่า .env เรียบร้อย ✓" 'Green'

# ---------- 6) ติดตั้งแพ็กเกจ ----------
foreach ($dir in @($backend, $frontend)) {
  if (-not (Test-Path (Join-Path $dir 'node_modules'))) {
    Say "กำลังติดตั้งแพ็กเกจใน $(Split-Path $dir -Leaf) (ครั้งแรกอาจใช้เวลา 1-3 นาที)..."
    Push-Location $dir; npm install --no-audit --no-fund; $code = $LASTEXITCODE; Pop-Location
    if ($code -ne 0) { Fail "npm install ใน $dir ไม่สำเร็จ" }
  }
}
Say "ติดตั้งแพ็กเกจเรียบร้อย ✓" 'Green'

# ---------- 7) เปิด backend + frontend + เบราว์เซอร์ ----------
Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', "cd '$backend'; npm run dev"
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', "cd '$frontend'; npm run dev"
Start-Sleep -Seconds 6
Start-Process 'http://localhost:5173'
Say "`nเปิดระบบแล้ว! เว็บอยู่ที่ http://localhost:5173" 'Green'
Say "ระบบกำลังเติมรูปปกและข้อมูลหนังสือเบื้องหลัง (ดูในหน้าต่าง backend ข้อความขึ้นต้น [books])" 'Cyan'
Say "ปิดระบบ: ปิดหน้าต่าง PowerShell ที่เปิดขึ้นมาใหม่ 2 หน้าต่าง"
Read-Host "`nกด Enter เพื่อปิดหน้าต่างนี้"
