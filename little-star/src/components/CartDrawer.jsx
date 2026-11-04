import React from 'react'

export default function CartDrawer({ isOpen, onClose, cartItems, onUpdateQuantity, onRemoveItem, onSaveToWishlist, onViewCart }) {
  if (!isOpen) return null

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const freeShippingThreshold = 10000
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal)
  const shippingProgress = Math.min(100, (subtotal / freeShippingThreshold) * 100)

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs transition-opacity">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
          
          {/* Header */}
          <div className="p-6 border-b border-brand-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-brand-logo text-lg font-bold tracking-tight text-brand-black">
                Shopping Bag
              </h2>
              <span className="text-xs bg-neutral-100 text-brand-charcoal px-2 py-0.5 font-semibold">
                ({cartItems.reduce((acc, item) => acc + item.quantity, 0)})
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-neutral-500 hover:text-black p-1 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Free Shipping Banner */}
          <div className="bg-[#F8F9FA] px-6 py-3 border-b border-brand-border text-xs">
            {remainingForFreeShipping === 0 ? (
              <p className="text-emerald-700 font-semibold flex items-center gap-1.5">
                <span>✓</span> You have qualified for Free Express Delivery!
              </p>
            ) : (
              <div>
                <p className="text-neutral-600">
                  Add <span className="font-bold text-black">PKR {remainingForFreeShipping.toLocaleString()}</span> more for <span className="font-semibold text-black">Free Express Delivery</span>
                </p>
                <div className="w-full bg-neutral-200 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-brand-black h-full transition-all duration-300"
                    style={{ width: `${shippingProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cart Item List */}
          <div className="p-6 overflow-y-auto flex-1 divide-y divide-brand-border">
            {cartItems.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-12 h-12 stroke-neutral-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25c-.67 0-1.189-.578-1.119-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                </svg>
                <p className="text-sm font-medium text-brand-dark">Your bag is currently empty</p>
                <p className="text-xs text-brand-gray mt-1">Discover handcrafted luxury children's wear today.</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-6 inline-block bg-brand-black text-white text-xs font-semibold uppercase tracking-wider px-6 py-2.5 hover:bg-neutral-800 cursor-pointer"
                >
                  Explore Collection
                </button>
              </div>
            ) : (
              cartItems.map((item) => (
                <div key={`${item.id}-${item.selectedSize}-${item.selectedColor || ''}`} className="py-4 flex gap-4">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-24 object-cover object-center bg-neutral-100 shrink-0"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <h4 className="text-xs font-semibold text-brand-black pr-2">
                          {item.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.id, item.selectedSize, item.selectedColor)}
                          className="text-neutral-400 hover:text-black cursor-pointer text-xs"
                        >
                          ✕
                        </button>
                      </div>
                      {item.selectedSize && (
                        <p className="text-[11px] text-brand-gray mt-0.5">Size: {item.selectedSize}</p>
                      )}
                      {item.selectedColor && (
                        <p className="text-[11px] text-brand-gray mt-0.5">Color: {item.selectedColor}</p>
                      )}
                      <p className="text-xs font-bold text-brand-black mt-1">
                        PKR {(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center border border-brand-border">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.id, item.selectedSize, item.quantity - 1, item.selectedColor)}
                          className="px-2 py-0.5 text-xs hover:bg-neutral-100 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-2.5 text-xs font-semibold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.id, item.selectedSize, item.quantity + 1, item.selectedColor)}
                          className="px-2 py-0.5 text-xs hover:bg-neutral-100 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      {onSaveToWishlist && (
                        <button type="button" onClick={() => onSaveToWishlist(item.id)} className="text-[10px] text-neutral-500 hover:text-black underline underline-offset-2">
                          Save to wishlist
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Checkout */}
          {cartItems.length > 0 && (
            <div className="p-6 border-t border-brand-border bg-[#FAFAFA]">
              <div className="flex items-center justify-between text-xs text-brand-gray mb-1">
                <span>Shipping</span>
                <span>{subtotal >= freeShippingThreshold ? 'FREE' : 'Calculated at checkout'}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-brand-black mb-4">
                <span>Estimated Subtotal</span>
                <span>PKR {subtotal.toLocaleString()}</span>
              </div>
              <button type="button" onClick={onViewCart} className="w-full bg-brand-black text-white text-xs font-semibold uppercase tracking-wider py-3.5 hover:bg-neutral-800 cursor-pointer">
                Review cart & checkout
              </button>
              {onViewCart && <button type="button" onClick={onViewCart} className="w-full mt-2 text-xs font-semibold uppercase tracking-wider py-2.5 underline underline-offset-4">View full cart</button>}
              <p className="text-[10px] text-center text-neutral-400 mt-2">
                Online checkout is not connected. No payment has been taken.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
