import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import { ManagedSiteProvider } from './lib/ManagedSiteContext.jsx'
import AuthPage, { AuthCallback, CustomerAccount } from './auth/AuthPages.jsx'
import AdminDashboard from './admin/AdminDashboard.jsx'
import ProtectedRoute from './auth/ProtectedRoute.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import './index.css'
import App from './App.jsx'
import './auth-admin.css'
import './redesign.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <ManagedSiteProvider>
          <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
            <Route path="/reset-password" element={<AuthPage mode="reset" />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/admin/login" element={<AuthPage mode="admin-login" />} />
            <Route
              path="/account/*"
              element={<ProtectedRoute role="customer"><CustomerAccount /></ProtectedRoute>}
            />
            <Route
              path="/admin/*"
              element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>}
            />
            <Route path="*" element={<App />} />
          </Routes>
        </ManagedSiteProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
