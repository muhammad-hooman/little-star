import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export default function ProtectedRoute({ children, role }) {
  const { user, profile, loading, profileError } = useAuth()
  const location = useLocation()

  if (loading) {
    return <main className="auth-loading" role="status">Loading your secure session…</main>
  }

  if (!user) {
    const loginPath = role === 'admin' ? '/admin/login' : '/login'
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />
  }

  if (profileError || !profile) {
    return (
      <main className="auth-loading">
        <section className="auth-feedback auth-feedback-error" role="alert">
          {profileError || 'Your profile is not available. Contact the store administrator.'}
        </section>
      </main>
    )
  }

  if (role && profile.role !== role) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/account'} replace />
  }

  return children
}
