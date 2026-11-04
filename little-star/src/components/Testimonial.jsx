import React, { useState, useEffect } from 'react'
import { TESTIMONIALS } from '../data/products'

const ENRICHED_REVIEWS = [
  {
    id: 1,
    quote: "Beautiful designs, exquisite craftsmanship, and outfits that made our little boy look and feel extraordinary on his first royal occasion.",
    author: "Ayesha & Farhan K.",
    location: "Lahore, Pakistan",
    city: "Lahore",
    initials: "AF",
    tag: "Bespoke Royal Sherwani",
    event: "Family Wedding"
  },
  {
    id: 2,
    quote: "The quality of the fabric and tailoring is unmatched. Our kids were super comfortable throughout the entire wedding event!",
    author: "Zainab & Bilal M.",
    location: "Karachi, Pakistan",
    city: "Karachi",
    initials: "ZB",
    tag: "Italian Coat Pant Suit",
    event: "Baraat Ceremony"
  },
  {
    id: 3,
    quote: "Exceptional attention to detail in the Sherwani collection. Little Star has truly mastered luxury children's ethnic couture.",
    author: "Dr. Hamza Tariq",
    location: "Islamabad, Pakistan",
    city: "Islamabad",
    initials: "HT",
    tag: "Heirloom Ivory Sherwani & Turban",
    event: "Walima Celebration"
  }
]

export default function Testimonial() {
  const [index, setIndex] = useState(2) // Default to Dr. Hamza Tariq (shown in screenshot)
  const [isFading, setIsFading] = useState(false)

  const changeSlide = (newIndex) => {
    if (newIndex === index) return
    setIsFading(true)
    setTimeout(() => {
      setIndex(newIndex)
      setIsFading(false)
    }, 180)
  }

  const handlePrev = () => {
    const nextIdx = index === 0 ? ENRICHED_REVIEWS.length - 1 : index - 1
    changeSlide(nextIdx)
  }

  const handleNext = () => {
    const nextIdx = index === ENRICHED_REVIEWS.length - 1 ? 0 : index + 1
    changeSlide(nextIdx)
  }

  // Gentle auto-rotation every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev === ENRICHED_REVIEWS.length - 1 ? 0 : prev + 1))
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  const current = ENRICHED_REVIEWS[index] || ENRICHED_REVIEWS[0]

  return (
    <section 
      className="w-full bg-[#fcf9f8] text-[#1c1b1b] relative overflow-hidden py-16 sm:py-24 my-8 sm:my-14 border-y border-[#e8dedf]" 
      data-purpose="customer-testimonial"
    >
      {/* Background Subtle Luxury Dot Pattern & Warm Soft Ambient Glow */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#b69966_1px,transparent_1px)] [background-size:26px_26px] pointer-events-none" />
      <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[700px] h-[350px] bg-[radial-gradient(circle,#faece4_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header with Eyebrow */}
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-xs text-[#b69966]">✦</span>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] text-[#b69966]">
              PATRON EXPERIENCES
            </span>
            <span className="text-xs text-[#b69966]">✦</span>
          </div>
          <h2 
            className="text-2xl sm:text-3xl lg:text-4xl text-[#3a1021] font-normal leading-tight font-serif" 
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Cherished by Families Across Pakistan
          </h2>
        </div>

        {/* The Luxury Gilded Maroon Card Stage */}
        <div className="relative max-w-3xl mx-auto bg-gradient-to-b from-[#2e091a] via-[#240614] to-[#1c040f] border border-[#ffdea7]/30 rounded-2xl p-7 sm:p-12 shadow-[0_20px_60px_rgba(42,8,24,0.28)]">
          
          {/* Subtle Corner Gold Flourishes */}
          <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#ffdea7]/60 rounded-tl" />
          <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-[#ffdea7]/60 rounded-tr" />
          <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-[#ffdea7]/60 rounded-bl" />
          <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-[#ffdea7]/60 rounded-br" />

          {/* Top Card Badge: Monogram & Verified Stars */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              {/* Monogram Crest */}
              <div className="w-12 h-12 rounded-full border border-[#ffdea7] bg-[#1a040e] text-[#ffdea7] flex items-center justify-center font-bold text-sm tracking-wider shadow-inner font-serif">
                {current.initials}
              </div>
              <div className="text-left">
                <span className="text-xs sm:text-sm font-bold text-white block">
                  {current.author}
                </span>
                <span className="text-[11px] text-[#e5cfd4] font-light">
                  {current.location}
                </span>
              </div>
            </div>

            {/* Stars & Verified Badge */}
            <div className="flex items-center gap-2 bg-[#ffdea7]/15 border border-[#ffdea7]/30 px-3.5 py-1.5 rounded-full">
              <div className="flex text-[#ffdea7] text-xs tracking-widest">
                <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
              </div>
              <span className="text-[10px] font-bold text-[#ffdea7] uppercase tracking-wider">
                Verified
              </span>
            </div>
          </div>

          {/* Garment Tag */}
          <div className="pt-5 text-center">
            <span className="inline-block text-[11px] uppercase tracking-wider text-[#ffdea7] font-semibold bg-white/10 border border-white/15 px-4 py-1 rounded-full">
              Order: {current.tag} • {current.event}
            </span>
          </div>

          {/* The Testimonial Quote Body */}
          <div className="py-6 sm:py-8 min-h-[120px] flex items-center justify-center text-center">
            <p 
              className={`font-serif text-lg sm:text-2xl lg:text-[25px] text-white italic leading-relaxed font-normal transition-all duration-200 ${
                isFading ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
              }`}
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              “{current.quote}”
            </p>
          </div>

          {/* Bottom Controls: Prev/Next & Carousel Dots */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <button
              type="button"
              aria-label="Previous review"
              onClick={handlePrev}
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#ffdea7] hover:text-white transition-colors cursor-pointer p-2"
            >
              <span>←</span>
              <span className="hidden sm:inline">Previous</span>
            </button>

            {/* Interactive City Tabs */}
            <div className="flex items-center gap-2">
              {ENRICHED_REVIEWS.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeSlide(i)}
                  className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full transition-all cursor-pointer ${
                    i === index 
                      ? 'bg-[#ffdea7] text-[#240614] font-bold shadow-md' 
                      : 'bg-white/10 hover:bg-white/20 text-[#e5cfd4]'
                  }`}
                >
                  {item.city}
                </button>
              ))}
            </div>

            <button
              type="button"
              aria-label="Next review"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#ffdea7] hover:text-white transition-colors cursor-pointer p-2"
            >
              <span className="hidden sm:inline">Next</span>
              <span>→</span>
            </button>
          </div>

        </div>

        {/* 3 Trust Pillars Bar Below */}
        <div className="mt-12 pt-8 border-t border-[#e8dedf] grid grid-cols-1 md:grid-cols-3 gap-6 text-center text-xs text-[#6b5e62]">
          <div className="flex items-center justify-center gap-2.5">
            <span className="text-[#b69966] text-base">★</span>
            <span><strong className="text-[#1c1b1b]">4.9 / 5.0 Rating</strong> across 1,200+ milestone celebrations</span>
          </div>
          <div className="flex items-center justify-center gap-2.5">
            <span className="text-[#b69966] text-base">✂</span>
            <span><strong className="text-[#1c1b1b]">100% Bespoke Alterations</strong> guaranteed across Pakistan</span>
          </div>
          <div className="flex items-center justify-center gap-2.5">
            <span className="text-[#b69966] text-base">📦</span>
            <span><strong className="text-[#1c1b1b]">White-Glove Express Delivery</strong> in heirloom keepsake boxes</span>
          </div>
        </div>

      </div>
    </section>
  )
}
