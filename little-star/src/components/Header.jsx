import React, { useEffect, useState } from 'react'

export default function Header({ currentRoute, wishlistCount, cartCount, onOpenCart, onOpenSearch }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const navLinks = [
    { name: 'Home', href: '#/', route: 'home' },
    { name: 'New Arrivals', href: '#/new-arrivals', route: 'new-arrivals' },
    { name: 'Casual Dressing', href: '#/casual-dressing', route: 'casual-dressing' },
    { name: 'Coat Pant', href: '#/coat-pant', route: 'coat-pant' },
    { name: 'Sherwani', href: '#/sherwani', route: 'sherwani' },
    { name: 'Prince Coat', href: '#/prince-coat', route: 'prince-coat' },
    { name: 'Sale', href: '#/sale', route: 'sale', isSale: true }
  ]

  const closeMenu = () => setMobileMenuOpen(false)

  return (
    <>
      <header className="ls-header">
        <div className="ls-header-inner">
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="ls-mobile-drawer"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="ls-menu-toggle"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              {mobileMenuOpen
                ? <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
                : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
          <a className="ls-wordmark" data-purpose="brand-logo" href="#/" onClick={closeMenu}>
            <span>LITTLE STAR</span><small>DRESS THE FUTURE</small>
          </a>
          <nav className="ls-desktop-nav" aria-label="Main navigation" data-purpose="primary-navigation">
            {navLinks.map((link) => (
              <a key={link.name} href={link.href} aria-current={currentRoute === link.route ? 'page' : undefined}
                className={`${currentRoute === link.route ? 'is-active' : ''} ${link.isSale ? 'is-sale' : ''}`}>
                {link.name}{link.isSale && <span className="ls-sale-label">Sale</span>}
              </a>
            ))}
          </nav>
          <div className="ls-header-actions" data-purpose="header-actions">
            <button type="button" aria-label="Search catalog" onClick={onOpenSearch} className="ls-search-action">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10.8" cy="10.8" r="6.8" /><path strokeLinecap="round" d="m16 16 4.5 4.5" /></svg>
              <span>Search the atelier</span>
            </button>
            <a aria-label="Wishlist" className="ls-icon-action ls-desktop-wishlist" href="#/wishlist">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path strokeLinecap="round" strokeLinejoin="round" d="M20.8 8.7c0 5.4-8.8 11-8.8 11s-8.8-5.6-8.8-11A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" /></svg>
              <span className="ls-count">{wishlistCount}</span>
            </a>
            <a aria-label="User account" className="ls-icon-action" href="/account">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="3.3" /><path strokeLinecap="round" strokeLinejoin="round" d="M5 20a7 7 0 0 1 14 0" /></svg>
            </a>
            <button type="button" aria-label={`Shopping bag, ${cartCount} items`} onClick={onOpenCart} className="ls-icon-action ls-bag-action">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14l1 13H4L5 8Z" /><path strokeLinecap="round" d="M9 9V6a3 3 0 0 1 6 0v3" /></svg>
              <span className="ls-count">{cartCount}</span>
            </button>
          </div>
        </div>
      </header>
      <div className={`ls-drawer-scrim ${mobileMenuOpen ? 'is-open' : ''}`} onClick={closeMenu} aria-hidden="true" />
      <aside id="ls-mobile-drawer" className={`ls-mobile-drawer ${mobileMenuOpen ? 'is-open' : ''}`} aria-label="Mobile navigation" aria-hidden={!mobileMenuOpen} inert={!mobileMenuOpen}>
        <div className="ls-drawer-heading">
          <span className="ls-wordmark"><span>LITTLE STAR</span><small>DRESS THE FUTURE</small></span>
          <button type="button" aria-label="Close navigation menu" onClick={closeMenu} className="ls-icon-action"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg></button>
        </div>
        <p className="ls-drawer-kicker">Collections</p>
        <nav className="ls-drawer-links" aria-label="Collections">
          {navLinks.map((link) => <a key={link.name} href={link.href} onClick={closeMenu} className={link.isSale ? 'is-sale' : ''}><span>{link.name}</span><span aria-hidden="true">›</span></a>)}
        </nav>
        <div className="ls-drawer-account"><a href="/account" onClick={closeMenu}>My Account</a><a href="#/wishlist" onClick={closeMenu}>Wishlist ({wishlistCount})</a></div>
      </aside>
      <nav className="ls-mobile-tabbar" aria-label="Quick navigation">
        <a href="#/" aria-current={currentRoute === 'home' ? 'page' : undefined}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" /></svg><small>Home</small></a>
        <a href="#/new-arrivals" aria-current={currentRoute === 'new-arrivals' ? 'page' : undefined}><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg><small>Collections</small></a>
        <a href="#/wishlist" aria-current={currentRoute === 'wishlist' ? 'page' : undefined}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 8.7c0 5.4-8.8 11-8.8 11s-8.8-5.6-8.8-11A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" /></svg><small>Wishlist</small><b>{wishlistCount}</b></a>
        <button type="button" onClick={onOpenCart} aria-label={`Shopping bag, ${cartCount} items`}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg><small>Bag</small><b>{cartCount}</b></button>
        <a href="/account" aria-current={currentRoute === 'account' ? 'page' : undefined}><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.3" /><path d="M5 20a7 7 0 0 1 14 0" /></svg><small>Account</small></a>
      </nav>
    </>
  )
}