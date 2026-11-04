import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import StageTwoWorkspace from './StageTwoWorkspace'
import StageThreeWorkspace, { AdminOverview } from './BusinessAnalytics'
import { MediaWorkspace, WebsiteContentWorkspace } from './MediaManagement'

const NAVIGATION = [
  { label: 'Overview', slug: '', icon: 'OV' },
  { label: 'Products', slug: 'products', icon: 'PR' },
  { label: 'Product Image Manager', slug: 'product-images', icon: 'PI' },
  { label: 'Categories', slug: 'categories', icon: 'CA' },
  { label: 'Inventory', slug: 'inventory', icon: 'IN' },
  { label: 'Orders', slug: 'orders', icon: 'OR' },
  { label: 'Customers', slug: 'customers', icon: 'CU' },
  { label: 'Discounts', slug: 'discounts', icon: 'DI' },
  { label: 'Media Library', slug: 'media-library', icon: 'ME' },
  { label: 'Website Content', slug: 'website-content', icon: 'WE' },
  { label: 'Homepage Manager', slug: 'homepage-manager', icon: 'HM' },
  { label: 'Size Chart Manager', slug: 'size-chart', icon: 'SC' },
  { label: 'Suppliers', slug: 'suppliers', icon: 'SU' },
  { label: 'Purchases', slug: 'purchases', icon: 'PU' },
  { label: 'Expenses', slug: 'expenses', icon: 'EX' },
  { label: 'Reports', slug: 'reports', icon: 'RE' },
  { label: 'Notifications', slug: 'notifications', icon: 'NO' },
  { label: 'Settings', slug: 'settings', icon: 'SE' },
  { label: 'Admin Users', slug: 'admin-users', icon: 'AD' }
]

function Sidebar({ open, onNavigate }) {
  return (
    <>
      {open && <button className="admin-sidebar-backdrop" aria-label="Close navigation" onClick={onNavigate} />}
      <aside className={`admin-sidebar ${open ? 'is-open' : ''}`} aria-label="Admin navigation">
        <Link className="admin-brand" to="/admin" onClick={onNavigate}>
          <span className="admin-brand-mark">LS</span>
          <span>LITTLE STAR<small>STORE ADMIN</small></span>
        </Link>
        <p className="admin-nav-heading">WORKSPACE</p>
        <nav className="admin-nav">
          {NAVIGATION.map((item) => (
            <NavLink
              key={item.slug}
              to={item.slug ? `/admin/${item.slug}` : '/admin'}
              end={!item.slug}
              onClick={onNavigate}
              className={({ isActive }) => `admin-nav-link${isActive ? ' is-active' : ''}`}
            >
              <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <Link className="admin-store-link" to="/">← View storefront</Link>
      </aside>
    </>
  )
}

export default function AdminDashboard() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const currentSlug = location.pathname.replace(/^\/admin\/?/, '').split('/')[0]
  const currentSection = NAVIGATION.find((item) => item.slug === currentSlug)
  const handleSignOut = async () => {
    setSignOutError('')
    try {
      await signOut()
      navigate('/admin/login', { replace: true })
    } catch (error) {
      setSignOutError(error.message || 'You could not be signed out.')
    }
  }

  return (
    <div className="admin-shell">
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-toggle" type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="admin-topbar-context"><span>Store administration</span><span aria-hidden="true">/</span><strong>{currentSection?.label || 'Overview'}</strong></div>
          <div className="admin-topbar-actions">
            <Link className="admin-notification-button" to="/admin/notifications" aria-label="Notifications">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
              </svg><span>Notifications</span>
            </Link>
            <div className="admin-profile-wrapper">
              <button className="admin-profile-button" type="button" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}>
                <span className="admin-avatar">{(profile?.full_name || profile?.email || 'A').slice(0, 1).toUpperCase()}</span>
                <span className="admin-profile-copy"><strong>{profile?.full_name || 'Administrator'}</strong><small>Administrator</small></span>
                <span aria-hidden="true">⌄</span>
              </button>
              {profileMenuOpen && (
                <div className="admin-profile-menu">
                  <p>{profile?.email}</p>
                  <button type="button" onClick={handleSignOut}>Sign out</button>
                  {signOutError && <span role="alert">{signOutError}</span>}
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="admin-content">
          {['products', 'categories', 'inventory', 'orders', 'customers'].includes(currentSlug)
            ? <StageTwoWorkspace section={currentSlug} />
            : currentSlug === 'product-images'
              ? <MediaWorkspace typeFilter="product" />
              : currentSlug === 'media-library'
                ? <MediaWorkspace />
                : ['website-content', 'homepage-manager', 'size-chart'].includes(currentSlug)
                  ? <WebsiteContentWorkspace sectionFilter={currentSlug} />
            : ['expenses', 'suppliers', 'purchases', 'reports'].includes(currentSlug)
              ? <StageThreeWorkspace section={currentSlug} />
              : currentSlug
                ? <section className="admin-page-heading"><div><p className="admin-eyebrow">LITTLE STAR STORE ADMIN</p><h1>{currentSection?.label || 'Workspace'}</h1><div className="admin-section-placeholder"><span className="admin-chart-icon" aria-hidden="true">✳</span><h2>This workspace is not part of this stage</h2><p>Existing store and account functionality is unchanged.</p></div></div></section>
                : <AdminOverview />}
        </main>
      </div>
    </div>
  )
}
