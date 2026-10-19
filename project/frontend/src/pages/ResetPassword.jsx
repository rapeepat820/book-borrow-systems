import { Navigate } from 'react-router-dom';

// เปลี่ยนจากลิงก์รีเซ็ตเป็นระบบ OTP แล้ว: ลิงก์เก่าๆ จะถูกพาไปหน้าลืมรหัสผ่าน
export default function ResetPassword() {
  return <Navigate to="/forgot-password" replace />;
}
