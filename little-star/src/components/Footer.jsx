import React, { useState } from 'react'
import { useManagedSite } from '../lib/ManagedSiteContext'

export default function Footer() {
  const { getPublishedContent } = useManagedSite()
  const content = getPublishedContent('store.footer') || {}
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e) => {
    e.preventDefault()
    if (email) {
      setSubscribed(true)
      setEmail('')
      setTimeout(() => setSubscribed(false), 4000)
    }
  }

  return (
    <footer className="ls-footer bg-white border-t border-brand-border text-brand-dark pt-16 pb-12" data-purpose="site-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 pb-12 border-b border-brand-border">
          
          {/* Column 1: Brand Info (4 cols) */}
          <div className="lg:col-span-4">
            <span className="font-brand-logo text-2xl font-bold tracking-tight text-brand-black flex items-center gap-1.5">
              LITTLE STAR
              <svg className="w-3.5 h-3.5 fill-brand-black inline-block" viewBox="0 0 24 24">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </span>
            <span className="block text-[10px] uppercase tracking-widest text-brand-muted font-medium mt-0.5">
              Dress the Future
            </span>
            <p className="text-xs text-brand-gray leading-relaxed mt-4 max-w-sm">
              {content.description || "LITTLE STAR is Pakistan's premier luxury children's clothing atelier, delivering timeless everyday pieces and handcrafted bespoke ceremonial ensembles for ages 1 through 13."}
            </p>
            <div className="mt-6 flex items-center space-x-3 text-brand-charcoal">
              <a
                aria-label="Instagram"
                className="w-8 h-8 rounded-full border border-neutral-300 flex items-center justify-center hover:bg-black hover:text-white transition-colors"
                href={content.instagram_url || 'https://instagram.com'}
                target="_blank"
                rel="noreferrer"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"></path>
                </svg>
              </a>
              <a
                aria-label="Facebook"
                className="w-8 h-8 rounded-full border border-neutral-300 flex items-center justify-center hover:bg-black hover:text-white transition-colors"
                href={content.facebook_url || 'https://facebook.com'}
                target="_blank"
                rel="noreferrer"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 8H6v4h3v12h5V12h3.642L18 8h-4V6.333C14 5.374 14.5 5 15.667 5H18V0h-3.889C10.5 0 9 1.5 9 4.667V8z"></path>
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2: Shop Categories (2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-xs uppercase font-bold tracking-widest text-brand-black mb-4">Collections</h4>
            <ul className="space-y-2 text-xs text-brand-gray">
              <li><a className="hover:text-black transition-colors" href="#/new-arrivals">New Arrivals</a></li>
              <li><a className="hover:text-black transition-colors" href="#/casual-dressing">Casual Dressing</a></li>
              <li><a className="hover:text-black transition-colors" href="#/coat-pant">Coat Pant Suits</a></li>
              <li><a className="hover:text-black transition-colors" href="#/sherwani">Festive Sherwanis</a></li>
              <li><a className="hover:text-black transition-colors" href="#/prince-coat">Royal Prince Coats</a></li>
              <li><a className="hover:text-black transition-colors text-red-600 font-semibold" href="#/sale">Special Sale</a></li>
            </ul>
          </div>

          {/* Column 3: Customer Care (2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-xs uppercase font-bold tracking-widest text-brand-black mb-4">Customer Care</h4>
            <ul className="space-y-2 text-xs text-brand-gray">
              <li><a className="hover:text-black transition-colors" href="#">Size Guide &amp; Fit</a></li>
              <li><a className="hover:text-black transition-colors" href="#">Shipping &amp; Delivery</a></li>
              <li><a className="hover:text-black transition-colors" href="#">Exchange &amp; Returns</a></li>
              <li><a className="hover:text-black transition-colors" href="#">Track Your Order</a></li>
              <li><a className="hover:text-black transition-colors" href="#">Store Locator</a></li>
              <li><a className="hover:text-black transition-colors" href="#">Contact Concierge</a></li>
            </ul>
          </div>

          {/* Column 4: Newsletter & Updates (4 cols) */}
          <div className="lg:col-span-4">
            <h4 className="text-xs uppercase font-bold tracking-widest text-brand-black mb-2">Join The Inner Circle</h4>
            <p className="text-xs text-brand-gray mb-4">Be the first to preview festive releases and private preview sales.</p>
            
            {subscribed ? (
              <div className="bg-neutral-100 border border-neutral-300 p-3 text-xs text-neutral-800 font-medium">
                Thank you for subscribing! Welcome to Little Star Inner Circle.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-2" data-purpose="newsletter-form">
                <div className="flex items-center">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs border border-brand-border px-3.5 py-3 focus:outline-none focus:border-brand-black text-brand-dark rounded-none placeholder-neutral-400 bg-white"
                    placeholder="Enter your email address"
                    required
                    type="email"
                  />
                  <button
                    className="bg-brand-black text-white text-xs font-semibold uppercase tracking-wider px-5 py-3 hover:bg-neutral-800 transition-colors shrink-0 rounded-none border border-brand-black cursor-pointer"
                    type="submit"
                  >
                    Subscribe
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400">By subscribing you agree with our Privacy Policy &amp; Terms.</p>
              </form>
            )}
          </div>

        </div>

        {/* Copyright & Currency Row */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-brand-muted gap-4">
          <p>{content.copyright || '© 2025 LITTLE STAR — Dress the Future. All Rights Reserved.'}</p>
          <div className="flex items-center space-x-6 text-[11px]">
            <a href="#privacy" className="hover:text-black transition-colors">Privacy Policy</a>
            <a href="#terms" className="hover:text-black transition-colors">Terms of Service</a>
            <a href="#security" className="hover:text-black transition-colors">Security</a>
            <span className="font-semibold text-brand-dark">PKR (₨)</span>
          </div>
        </div>

      </div>
    </footer>
  )
}