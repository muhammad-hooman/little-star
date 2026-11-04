import React, { useState, useEffect } from 'react'
import { FLASH_SALE_PRODUCTS, getProductHref } from '../data/products'
import { useManagedSite } from '../lib/ManagedSiteContext'

export default function FlashSales({ products = FLASH_SALE_PRODUCTS, onQuickView, onAddToCart, onToggleWishlist, wishlistIds = [] }) {
  const { getPublishedContent } = useManagedSite()
  const content = getPublishedContent('home.flash-sales') || {}
  const [timeLeft, setTimeLeft] = useState({
    days: 2,
    hours: 8,
    minutes: 45,
    seconds: 48
  })

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 }
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 }
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 }
        } else if (prev.days > 0) {
          return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 }
        }
        return { days: 2, hours: 8, minutes: 45, seconds: 59 }
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const pad = (num) => String(num).padStart(2, '0')

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16" data-purpose="flash-sales" id="sale">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 pb-4 border-b border-brand-border gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-brand-black">{content.headline || 'Flash Sales'}</h2>
            <span className="bg-red-500 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-none">
              {content.tag || 'Limited Period'}
            </span>
          </div>
          <p className="text-xs text-brand-gray mt-1">{content.description || 'Exclusive discounts on signature seasonal garments'}</p>
        </div>

        {/* Countdown Timer matching screenshot */}
        <div className="flex items-center text-xs font-medium text-brand-charcoal space-x-1.5">
          <span className="text-neutral-500">Ends In :</span>
          <span className="bg-neutral-100 font-bold px-2 py-1 rounded-sm text-brand-black">
            {pad(timeLeft.days)}d
          </span>
          <span>:</span>
          <span className="bg-neutral-100 font-bold px-2 py-1 rounded-sm text-brand-black">
            {pad(timeLeft.hours)}h
          </span>
          <span>:</span>
          <span className="bg-neutral-100 font-bold px-2 py-1 rounded-sm text-brand-black">
            {pad(timeLeft.minutes)}m
          </span>
          <span>:</span>
          <span className="bg-neutral-100 font-bold px-2 py-1 rounded-sm text-brand-black" id="seconds-counter">
            {pad(timeLeft.seconds)}s
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {products.map((item) => {
          const isWishlisted = wishlistIds.includes(item.id)
          return (
          <div
            key={item.id}
            className="product-card group"
            data-purpose="sale-card"
            onClick={(event) => {
              if (event.target.closest('a, button, input, select, textarea')) return
              window.location.hash = getProductHref(item)
            }}
          >
            <div className="product-image-container aspect-3/4 relative">
              <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 z-10">
                {item.discount}
              </span>
              {onToggleWishlist && (
                <button
                  type="button"
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                  onClick={() => onToggleWishlist(item.id)}
                  className={`absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg ${isWishlisted ? 'text-red-600' : 'text-brand-charcoal'}`}
                >
                  {isWishlisted ? '♥' : '♡'}
                </button>
              )}

              <a href={getProductHref(item)} aria-label={`View ${item.name}`}>
                <img
                  alt={item.name}
                  className="w-full h-full object-cover object-center"
                  src={item.image}
                />
              </a>

              {/* Hover Action Buttons */}
              <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-2">
                <button
                  type="button"
                  onClick={() => onQuickView(item)}
                  className="flex-1 bg-brand-black text-white text-xs font-medium py-2.5 uppercase tracking-wider hover:bg-neutral-800 cursor-pointer transition-colors"
                >
                  Quick View
                </button>
                <button
                  type="button"
                  onClick={() => onAddToCart(item)}
                  className="bg-white text-brand-black border border-brand-black px-3 py-2.5 text-xs font-medium hover:bg-neutral-100 cursor-pointer transition-colors"
                  title="Add to cart"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-brand-dark group-hover:text-neutral-600 transition-colors">
                <a href={getProductHref(item)}>
                  {item.name}
                </a>
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm font-bold text-red-600">{item.priceFormatted}</span>
                <span className="text-xs text-brand-muted line-through font-normal">{item.originalPriceFormatted}</span>
              </div>
            </div>
          </div>
          )
        })}
      </div>
    </section>
  )
}