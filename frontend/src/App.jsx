import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Wallet from './pages/Wallet.jsx';
import MasterProfile from './pages/MasterProfile.jsx';
import Profile from './pages/Profile.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import MasterDashboard from './pages/MasterDashboard.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Reservations from './pages/Reservations.jsx';
import Chat from './pages/Chat.jsx';
import Voice from './pages/Voice.jsx';
import Privacy from './pages/Privacy.jsx';
import Cookie from './pages/Cookie.jsx';
import Terms from './pages/Terms.jsx';
import ClientProfile from './pages/ClientProfile.jsx';
import Support from './pages/Support.jsx';
import Business from './pages/Business.jsx';
import Experience from './pages/Experience.jsx';

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(14, 20, 27, 0.92)',
            color: '#f6f8ff',
            border: '1px solid rgba(138, 153, 198, 0.24)',
            borderRadius: '16px',
            boxShadow: '0 18px 45px -20px rgba(14, 20, 27, 0.8)',
            fontSize: '16px',
            padding: '16px 20px',
            minWidth: '320px',
            maxWidth: '500px'
          }
        }}
      />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/masters/:id" element={<MasterProfile />} />
          <Route path="/clients/:id" element={<ClientProfile />} />
          <Route path="/master/dashboard" element={<MasterDashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:threadId" element={<Chat />} />
          <Route path="/voice" element={<Voice />} />
          <Route path="/voice/:sessionId" element={<Voice />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/cookie" element={<Cookie />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/support" element={<Support />} />
          <Route path="/business" element={<Business />} />
          <Route path="/experience" element={<Experience />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
