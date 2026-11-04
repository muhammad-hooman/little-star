import React, { useState } from 'react'

export default function QuickViewModal({ product, onClose, onAddToCart }) {
  const [selectedSize, setSelectedSize] = useState(product?.sizes ? product.sizes[0] : 'Standard')
  const [quantity, setQuantity] = useState(1)

  if (!product) return null

  const handleAdd = () => {
    onAddToCart(product, quantity, selectedSize)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-fadeIn">
      <div
        className="relative bg-white w-full max-w-3xl overflow-hidden shadow-2xl border border-neutral-200 grid grid-cols-1 md:grid-cols-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          aria-label="Close modal"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/90 text-neutral-600 hover:text-black flex items-center justify-center shadow-xs cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Product image */}
        <div className="aspect-3/4 bg-neutral-100 relative">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover object-center"
          />
          {product.discount && (
            <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5">
              {product.discount}
            </span>
          )}
          {product.isNew && (
            <span className="absolute top-3 left-3 bg-brand-black text-white text-[9px] font-semibold tracking-wider px-2 py-0.5 uppercase">
              New
            </span>
          )}
        </div>

        {/* Product Details */}
        <div className="p-6 md:p-8 flex flex-col justify-between">
          <div>
            <p className="text-[11px] text-brand-muted uppercase tracking-wider font-semibold">
              {product.age || product.category || 'Luxury Collection'}
            </p>
            <h3 className="text-xl md:text-2xl font-bold text-brand-black mt-1 leading-snug">
              {product.name}
            </h3>

            <div className="flex items-center space-x-3 mt-3">
              <span className="text-lg font-bold text-brand-black">
                {product.priceFormatted}
              </span>
              {product.originalPriceFormatted && (
                <span className="text-xs text-brand-muted line-through">
                  {product.originalPriceFormatted}
                </span>
              )}
            </div>

            <p className="text-xs text-brand-gray mt-4 leading-relaxed font-normal">
              {product.description || 'Crafted with premium ceremonial standards, hand-finished detailing, and supreme comfortable cotton fabrics for children.'}
            </p>

            {/* Size selector */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="mt-6">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-charcoal block mb-2">
                  Select Size (Age):
                </span>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`text-xs px-3 py-1.5 border transition-all cursor-pointer ${
                        selectedSize === size
                          ? 'border-brand-black bg-brand-black text-white font-semibold'
                          : 'border-brand-border bg-white text-neutral-700 hover:border-black'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mt-5 flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-charcoal">
                Quantity:
              </span>
              <div className="flex items-center border border-brand-border">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-2.5 py-1 text-xs hover:bg-neutral-100 cursor-pointer"
                >
                  -
                </button>
                <span className="px-3 text-xs font-semibold">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="px-2.5 py-1 text-xs hover:bg-neutral-100 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-brand-border">
            <button
              type="button"
              onClick={handleAdd}
              className="w-full bg-brand-black text-white text-xs font-semibold uppercase tracking-wider py-3.5 hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
            >
              Add To Cart — PKR {(product.price * quantity).toLocaleString()}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

