import React from 'react'
import { useManagedSite } from '../lib/ManagedSiteContext'

export default function WideBanner() {
  const { getPublishedContent, resolveImage } = useManagedSite()
  const content = getPublishedContent('home.wide-banner') || {}
  const image = resolveImage(content.image_key || 'home.wide-banner', 'https://lh3.googleusercontent.com/aida-public/AB6AXuA13Ad-HhVxjF9JgHgst9URKs4iyPE2D7PzvmrnntbPzbvWrk7BRMsfH8lwVIA4vg3rQf_rU8eZCMxD2tOww4fRhg-UGO8L1A5ZLC5iFpMKzYU9emjSEgbAchB-rZMafZ-0aJdoJskD6867PyLsC3ZT5Ry5jsZ8s6EVyUBvHBVvKWe3Y3DpcnWtjSsC_LlXgaNb0kYVuJD329eTAUgMAcLzUThTsTbamM41sO1T12Zs08nzT_9ksgxe')
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-purpose="wide-editorial-banner">
      <div className="bg-[#ECEEF0] border border-neutral-200 overflow-hidden grid grid-cols-1 md:grid-cols-12 items-center">
        
        <div className="md:col-span-5 h-85 md:h-100">
          <img
            alt={content.alt_text || 'Young model wearing jacket in casual urban setting'}
            className="w-full h-full object-cover object-center"
            src={image}
          />
        </div>

        <div className="md:col-span-7 p-8 sm:p-14 lg:p-16">
          <span className="text-[10px] uppercase font-bold tracking-widest text-brand-muted block mb-2">
            {content.tag || "Winter &amp; Spring '25 Edition"}
          </span>
          <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-brand-black mb-4">
            {content.headline || 'The Little Gentleman Selection'}
          </h3>
          <p className="text-sm text-brand-gray leading-relaxed max-w-lg mb-8">
            {content.description || 'From everyday playtime outfits to bespoke occasion tuxedos, discover timeless garments made with breathability, ease of movement, and enduring tailoring.'}
          </p>
          <a
            className="inline-block bg-brand-black text-white text-xs font-semibold uppercase tracking-wider px-8 py-3.5 hover:bg-neutral-800 transition-colors shadow-sm"
            href={content.link_href || '#/coat-pant'}
          >
            {content.link_text || 'Discover The Collection →'}
          </a>
        </div>

      </div>
    </section>
  )
}
