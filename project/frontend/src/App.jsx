import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import CustomerLayout from './components/CustomerLayout';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

import Home from './pages/Home';
import BookDetail from './pages/BookDetail';
import Borrow from './pages/Borrow';
import BorrowPayment from './pages/BorrowPayment';
import BorrowSuccess from './pages/BorrowSuccess';
import MyBook from './pages/MyBook';
import TrackingDetail from './pages/TrackingDetail';
import History from './pages/History';
import Profile from './pages/Profile';
import Menu from './pages/Menu';
import EditProfile from './pages/EditProfile';
import ChangePassword from './pages/ChangePassword';
import Terms from './pages/Terms';
import PrivacyPolicy from './pages/PrivacyPolicy';
import ReturnBook from './pages/ReturnBook';
import RequestExtend from './pages/RequestExtend';
import ExtendPayment from './pages/ExtendPayment';
import ExtendConfirmed from './pages/ExtendConfirmed';

import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminInventory from './pages/admin/AdminInventory';
import AdminMembers from './pages/admin/AdminMembers';
import AdminBorrowRecords from './pages/admin/AdminBorrowRecords';

export default function App() {
  return (
    <Routes>
      {/* หน้ายืนยันตัวตน */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* หน้าฝั่งลูกค้า */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/books/:id" element={<BookDetail />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/borrow/:id" element={<ProtectedRoute><Borrow /></ProtectedRoute>} />
        <Route path="/borrow/:id/payment" element={<ProtectedRoute><BorrowPayment /></ProtectedRoute>} />
        <Route path="/borrow-success/:id" element={<ProtectedRoute><BorrowSuccess /></ProtectedRoute>} />
        <Route path="/my-book" element={<ProtectedRoute><MyBook /></ProtectedRoute>} />
        <Route path="/track/:id" element={<ProtectedRoute><TrackingDetail /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/menu" element={<ProtectedRoute><Menu /></ProtectedRoute>} />
        <Route path="/menu/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
        <Route path="/menu/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
        <Route path="/return/:id" element={<ProtectedRoute><ReturnBook /></ProtectedRoute>} />
        <Route path="/extend/:id" element={<ProtectedRoute><RequestExtend /></ProtectedRoute>} />
        <Route path="/extend/:id/payment" element={<ProtectedRoute><ExtendPayment /></ProtectedRoute>} />
        <Route path="/extend/:id/confirmed" element={<ProtectedRoute><ExtendConfirmed /></ProtectedRoute>} />
      </Route>

      {/* หน้าฝั่งแอดมิน */}
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="books" element={<AdminInventory />} />
        <Route path="members" element={<AdminMembers />} />
        <Route path="borrow-records" element={<AdminBorrowRecords />} />
      </Route>
    </Routes>
  );
}
