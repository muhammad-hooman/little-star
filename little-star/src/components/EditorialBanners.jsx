import React, { useState } from 'react'
import brandVideo from '../../Untitled_Scene_11-04_16_49_36_20261104215102.mp4'

export default function EditorialBanners() {
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <section className="w-full bg-[#2e0b19] text-white relative overflow-hidden py-12 sm:py-16 my-4 sm:my-8" data-purpose="artisanal-excellence-section">
      {/* Background Subtle Luxury Dot Pattern & Ambient Glow */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffdea7_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-80 h-80 bg-[#ffdea7]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Brand Story (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 mb-2.5">
              <svg className="w-3.5 h-3.5 text-[#ffdea7]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0011 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 003.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
              </svg>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-[#ffdea7]">
                ARTISANAL EXCELLENCE
              </span>
            </div>

            {/* Heading */}
            <h2 className="text-3xl sm:text-4xl lg:text-[40px] text-white font-normal leading-[1.14] mb-3 font-serif" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Made for Their Biggest Moments.
            </h2>

            {/* Concise Refined Copy */}
            <p className="text-xs sm:text-sm text-[#ebd9dc] leading-relaxed mb-5 font-light max-w-md">
              Ceremonial grandeur tailored with children’s natural ease—butter-soft linings and effortless heirloom silhouettes.
            </p>

            {/* 3 Concise Checkpoints */}
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full border border-[#ffdea7] text-[#ffdea7] flex items-center justify-center text-[10px] shrink-0 mt-0.5 font-bold">
                  ✓
                </span>
                <div>
                  <h4 className="text-white text-xs sm:text-sm font-semibold tracking-wide">
                    Hand-Finished Collars
                  </h4>
                  <p className="text-[#d8c3c7] text-[11px] sm:text-xs mt-0.5 leading-snug font-light">
                    Smooth, friction-free necklines tailored for sensitive skin.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full border border-[#ffdea7] text-[#ffdea7] flex items-center justify-center text-[10px] shrink-0 mt-0.5 font-bold">
                  ✓
                </span>
                <div>
                  <h4 className="text-white text-xs sm:text-sm font-semibold tracking-wide">
                    Hypoallergenic Silk-Cotton Linings
                  </h4>
                  <p className="text-[#d8c3c7] text-[11px] sm:text-xs mt-0.5 leading-snug font-light">
                    Breathable natural fibers that keep children cool all day.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full border border-[#ffdea7] text-[#ffdea7] flex items-center justify-center text-[10px] shrink-0 mt-0.5 font-bold">
                  ✓
                </span>
                <div>
                  <h4 className="text-white text-xs sm:text-sm font-semibold tracking-wide">
                    Complimentary Doorstep Alterations
                  </h4>
                  <p className="text-[#d8c3c7] text-[11px] sm:text-xs mt-0.5 leading-snug font-light">
                    Doorstep pickup and re-tailoring across Pakistan for a flawless fit.
                  </p>
                </div>
              </div>
            </div>

            {/* High-Contrast Bold CTA Button */}
            <div>
              <a
                href="#/sherwani"
                className="inline-flex items-center gap-2 bg-[#ffdea7] hover:bg-[#fad38e] font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ color: '#260714', textDecoration: 'none' }}
              >
                <span style={{ color: '#260714', fontWeight: '700' }}>SHOP OCCASION WEAR</span>
                <span style={{ color: '#260714', fontWeight: '700' }} className="transition-transform group-hover:translate-x-1">→</span>
              </a>
            </div>
          </div>

          {/* Right Column: Video Campaign Frame (7 cols) */}
          <div className="lg:col-span-7">
            <div className="relative w-full aspect-8/5 rounded-xl overflow-hidden shadow-2xl bg-black border border-white/10 group">
              {isPlaying ? (
                <div className="relative w-full h-full">
                  <video
                    src={brandVideo}
                    autoPlay
                    controls
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ filter: 'brightness(1.12)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setIsPlaying(false)}
                    className="absolute top-3 right-3 bg-black/70 hover:bg-black text-white rounded-full p-2 text-xs z-20 backdrop-blur-sm transition-colors cursor-pointer"
                    aria-label="Close video"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="relative w-full h-full">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDY-vkRs7guZ-tZD_X6T4NVabt3-0CDv65AMBfjDXK4mYne1FVh0kieO9MRGnDq42TbIISamdlXgWb93ZUa-7kQLZ2NkibhC7whUYLcM0iWLX3C5oriCh6EyEaiu2rRzgbFlLRepdhUSOd9MkNL0up3CtH7bKHkRykevWXJsoCXLYybBKEggnaji9ig5k34wvMZliN5nXZFMlbG7U1k2Rbr7HXI9e_w5sOBaz3uoYnWmqP6GL5vVXJS"
                    alt="Little Star brand film: father fitting ivory sherwani and turban on his son"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    style={{ filter: 'brightness(1.08)' }}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

                  {/* Perfectly Centered Luxury Play Button */}
                  <button
                    type="button"
                    onClick={() => setIsPlaying(true)}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-brand-black flex items-center justify-center shadow-2xl ring-8 ring-white/20 hover:ring-white/35 transition-all duration-300 hover:scale-110 cursor-pointer focus:outline-none"
                    style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                    aria-label="Play brand film"
                  >
                    <span className="text-xl sm:text-2xl ml-1 font-bold text-brand-black">
                      ▶
                    </span>
                  </button>

                  {/* Bottom Video Metadata Ribbon */}
                  <div className="absolute bottom-3 inset-x-3 sm:bottom-4 sm:inset-x-4 bg-[#260714]/85 backdrop-blur-md px-4 py-2.5 rounded-lg flex items-center justify-between text-white border border-white/10 pointer-events-none">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#ffdea7]">
                        FILM: “THE LITTLE NAWAB” (02:45)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#d8c3c7]">
                      <span className="tracking-widest">|||·|||·|</span>
                      <span>HQ SOUND</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
