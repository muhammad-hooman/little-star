import React from 'react'
import { useManagedSite } from '../lib/ManagedSiteContext'

export default function EditorialBanners() {
  const { getPublishedContent, resolveImage, isContentEnabled } = useManagedSite()
  const everyday = getPublishedContent('home.editorial.everyday') || {}
  const formal = getPublishedContent('home.editorial.formal') || {}
  const sherwani = getPublishedContent('home.editorial.sherwani') || {}
  const image = (content, key, fallback) => resolveImage(content.image_key || key, fallback)
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-purpose="editorial-campaign-grid">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Large Left Card: Street Wear / Everyday Essentials (Spanning full height) */}
        {isContentEnabled('home.editorial.everyday') && <div className="lg:col-span-7 bg-[#EFEFEF] relative min-h-110 lg:min-h-135 flex items-center p-8 sm:p-12 overflow-hidden group">
          <img
            alt={everyday.alt_text || 'Little Street Wear Campaign'}
            className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 opacity-90 mix-blend-multiply"
            src={image(everyday, 'home.editorial.everyday', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrokJeVORIhZLZ6UivfcbgwJVi4NqQjc5Cdoc4Wd0zfx2A40QymK6lAKzIgExApQLGiKtm0cuFtPr05CgV-jd3VY2svEPKXkxC6hiUSmraBEnEz1wdb0dX16xVAG2BETbTOF6eAgrwXlM-rlUQ67Mj23JWn-_n4NbCs6UdzVX5qbfnOumABQ78zhdepO42SUTFJO_rKg1BfTHQdSkszhg6Wmj6T9DfbMhz3YFBaW_aknh2h_CXT6cT')}
          />
          <div className="relative z-10 max-w-sm bg-white/80 backdrop-blur-sm p-6 sm:p-8">
            <span className="text-[10px] uppercase tracking-widest text-brand-gray font-semibold block mb-2">
              {everyday.tag || 'Casual Collection'}
            </span>
            <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-brand-black mb-3">
              {everyday.headline || 'Little Street Wear.'}
            </h3>
            <p className="text-xs text-brand-gray leading-relaxed mb-6 font-normal">
              {everyday.description || 'Everyday essentials crafted with ultra-soft organic cotton for effortless little adventures.'}
            </p>
            <a
              className="inline-flex items-center text-xs font-semibold uppercase tracking-wider text-brand-black hover:text-neutral-600 group-link"
              href={everyday.link_href || '#/casual-dressing'}
            >
              {everyday.link_text || 'Shop Collection'}
              <span className="ml-1.5 transition-transform group-hover:translate-x-1">→</span>
            </a>
          </div>
        </div>}

        {/* Right Column: 2 Stacked Cards */}
        {(isContentEnabled('home.editorial.formal') || isContentEnabled('home.editorial.sherwani')) && <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Upper Right Card: Classic Coat Pant */}
          {isContentEnabled('home.editorial.formal') && <div className="bg-[#F5F5F7] p-8 flex-1 flex flex-col justify-between relative overflow-hidden group min-h-62.5">
            <div className="relative z-10 max-w-60">
              <span className="text-[10px] uppercase tracking-widest text-brand-muted font-semibold block mb-1">
                {formal.tag || 'Tailored Sartorial'}
              </span>
              <h4 className="text-2xl font-bold text-brand-black tracking-tight mb-2">
                {formal.headline || 'Classic Coat Pant.'}
              </h4>
              <p className="text-xs text-brand-gray mb-4">
                {formal.description || 'A refined Italian-cut silhouette for special moments.'}
              </p>
              <a
                className="text-xs font-semibold uppercase tracking-wider text-brand-black hover:underline flex items-center gap-1"
                href={formal.link_href || '#/coat-pant'}
              >
                Explore Collection →
              </a>
            </div>
            <img
              alt={formal.alt_text || 'Boy in tailored coat pant suit'}
              className="absolute right-0 top-0 bottom-0 w-1/2 object-cover object-center group-hover:scale-105 transition-transform duration-500"
              src={image(formal, 'home.hero.formal', 'https://lh3.googleusercontent.com/aida-public/AB6AXuAOHZj7Sep-7290IsgdzITdlnbtIx0TGNaA-iXSGMyu6RrqjvDbWlcExEEXGAjA_X2uQn1HuhdY7Ec1RWTRp34OkCT3M8mpOhFuYxIl0E_I7LHBx_ORIByEqdXuu94Ye4sRA04V6bbTCrIQVN0IRve6ylZ8tCBSX9sXTbxnVrW1CtO65TqU88u9mUrOWtTAxF9-yMP_mjxqdwgp61w8RsmaHSDPgZyzxfa-SuU04I4u5IsH6fi218oj')}
            />
          </div>}

          {/* Lower Right Card: Traditional Elegance (Sherwani / Festive) */}
          {isContentEnabled('home.editorial.sherwani') && <div className="bg-[#ECEAE6] p-8 flex-1 flex flex-col justify-between relative overflow-hidden group min-h-62.5">
            <div className="relative z-10 max-w-60">
              <span className="text-[10px] uppercase tracking-widest text-brand-muted font-semibold block mb-1">
                {sherwani.tag || 'Heritage Edition'}
              </span>
              <h4 className="text-2xl font-bold text-brand-black tracking-tight mb-2">
                {sherwani.headline || 'Traditional Elegance.'}
              </h4>
              <p className="text-xs text-brand-gray mb-4">
                {sherwani.description || 'Handcrafted festive Sherwanis with subtle threadwork.'}
              </p>
              <a
                className="text-xs font-semibold uppercase tracking-wider text-brand-black hover:underline flex items-center gap-1"
                href={sherwani.link_href || '#/sherwani'}
              >
                Explore Formal Wear →
              </a>
            </div>
            <img
              alt={sherwani.alt_text || "Festive traditional children's wear"}
              className="absolute right-0 top-0 bottom-0 w-1/2 object-cover object-center group-hover:scale-105 transition-transform duration-500"
              src={image(sherwani, 'home.editorial.sherwani', 'https://lh3.googleusercontent.com/aida-public/AB6AXuDi5XjgVAm49nLl3SG-Cv4VhO8UarmBdhkomskNtwMHHSqRW4WxgCXj0lYTznetTQ4YdpGFZx5a3GWrghwgHsGJdjfR9riJYevfRm_Q_PPer7qMEw5TPJ2Jj01HmSU8MEwJVMXsrtAlZEa1kgGw0MAr6psC8qnf0MBoC6A3RWJaZPLH0eF_CfvP7QLymE-ALK14G8nXvJj7upPcM3Ji2MvLn_Bw_tF97bBWQIAbhP93atG5jbSGydTL')}
            />
          </div>}

        </div>}
      </div>
    </section>
  )
}