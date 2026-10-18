const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// ตรวจสอบว่า login แล้วหรือไม่ (มี token ที่ถูกต้อง)
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบ' });
  }
  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, SECRET);
    req.user = payload; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'session หมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
}

// ตรวจสอบว่าเป็นแอดมินเท่านั้น
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'สำหรับผู้ดูแลระบบเท่านั้น' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, SECRET };
