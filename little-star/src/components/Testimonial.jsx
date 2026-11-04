import React, { useState } from 'react'
import { TESTIMONIALS } from '../data/products'

export default function Testimonial() {
  const [index, setIndex] = useState(0)

  const handlePrev = () => {
    setIndex((prev) => (prev === 0 ? TESTIMONIALS.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setIndex((prev) => (prev === TESTIMONIALS.length - 1 ? 0 : prev + 1))
  }

  const current = TESTIMONIALS[index]

  return (
    <section className="py-16 sm:py-24 border-y border-brand-border bg-brand-surface my-12" data-purpose="customer-testimonial">
      <div className="max-w-4xl mx-auto px-6 text-center">
        
        {/* Giant soft-grey quote icon */}
        <div className="font-editorial text-7xl lg:text-8xl text-neutral-300 leading-none select-none mb-2">
          “
        </div>

        <p className="font-editorial text-lg sm:text-2xl md:text-3xl text-brand-dark italic leading-relaxed max-w-3xl mx-auto font-normal min-h-[90px] flex items-center justify-center">
          {current.quote}
        </p>

        <div className="mt-6">
          <p className="text-xs uppercase font-semibold tracking-widest text-brand-black">
            {current.author}
          </p>
          <p className="text-[11px] text-brand-muted tracking-wider mt-0.5">
            {current.location}
          </p>
        </div>

        {/* Minimalist Next/Prev Quotation arrows */}
        <div className="flex items-center justify-center space-x-3 mt-8 text-neutral-400">
          <button
            type="button"
            aria-label="Previous testimonial"
            onClick={handlePrev}
            className="hover:text-black p-1 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </button>

          {TESTIMONIALS.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to testimonial ${i + 1}`}
              className={`rounded-full transition-all cursor-pointer ${
                i === index ? 'w-2 h-2 bg-brand-black' : 'w-1.5 h-1.5 bg-neutral-300 hover:bg-neutral-400'
              }`}
            />
          ))}

          <button
            type="button"
            aria-label="Next testimonial"
            onClick={handleNext}
            className="hover:text-black p-1 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </button>
        </div>

      </div>
    </section>
  )
}

