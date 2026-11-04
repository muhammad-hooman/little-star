import React from 'react'

export default function QuoteSection() {
  return (
    <section className="py-16 text-center border-t border-b border-brand-border bg-white" data-purpose="quote-of-the-day">
      <div className="max-w-3xl mx-auto px-6">
        <h4 className="text-xs uppercase font-bold tracking-widest text-brand-muted mb-4">Quote Of The Day</h4>
        <blockquote className="font-editorial text-xl sm:text-2xl text-brand-dark italic max-w-xl mx-auto">
          "Little moments become beautiful memories. Dress them with love, confidence, and comfort."
        </blockquote>
        <div className="w-8 h-px bg-brand-charcoal mx-auto mt-4 mb-2"></div>
        <cite className="text-[11px] uppercase tracking-wider text-brand-gray font-medium not-italic">
          — Little Star Philosophy
        </cite>
      </div>
    </section>
  )
}

