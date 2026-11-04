import React, { useState } from 'react'
import { getProductHref } from '../data/products'

export default function SearchModal({ isOpen, onClose, allProducts }) {
  const [query, setQuery] = useState('')

  if (!isOpen) return null

  const filtered = query.trim()
    ? allProducts.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(query.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(query.toLowerCase()))
      )
    : allProducts

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-black/60 backdrop-blur-xs">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-2xl shadow-2xl border border-neutral-200 overflow-hidden z-10">
        
        {/* Search Input Bar */}
        <div className="p-4 border-b border-brand-border flex items-center gap-3">
          <svg className="w-5 h-5 text-neutral-400 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search coat pants, sherwanis, kurtas, casuals..."
            className="w-full text-sm outline-none text-brand-black placeholder-neutral-400"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-black p-1 text-xs cursor-pointer font-bold"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto divide-y divide-brand-border p-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">
              No matching products found for "{query}".
            </div>
          ) : (
            filtered.map((item) => (
              <a
                key={item.id}
                href={getProductHref(item)}
                onClick={onClose}
                className="p-3 flex items-center justify-between hover:bg-neutral-50 cursor-pointer transition-colors no-underline"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-12 h-14 object-cover object-center bg-neutral-100 shrink-0"
                  />
                  <div>
                    <h4 className="text-xs font-semibold text-brand-black">{item.name}</h4>
                    <p className="text-[11px] text-brand-muted">{item.age || item.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-brand-black">{item.priceFormatted}</span>
                </div>
              </a>
            ))
          )}
        </div>

      </div>
    </div>
  )
}
