import React from 'react'
import { useManagedSite } from '../lib/ManagedSiteContext'

export default function OccasionWear() {
  const { getPublishedContent, resolveImage, isContentEnabled } = useManagedSite()
  const heading = getPublishedContent('home.occasion.heading') || {}
  const defaults = [
    {
      key: 'home.occasion.wedding',
      title: 'Weddings & Celebrations',
      tag: 'Bespoke Suits',
      linkText: 'Explore Coat Pants →',
      href: '#coat-pant',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBC7ZYWcXX4tBPhxQkUCTvFMXESokVH8zoPpnujsK-njRUM82jg7KmxzQpZOHwYoj5PeWaUIht8nUl5fTJaJPc_gfNlASSN_xfMjCPvgZbhILnZKz97Drb4sZJmXmtqMAkG6v6E5Lp8N75MfRxyJThUDxp-6JWHEtUEAVqkRTRYU6cZ7I9yf307DzwlHqrqLnzDH5DiaU52aC2hMgS9gH6uhHKhSXf-u9Ed2hbVi6CEJAEhOpbhZKB4',
      alt: "Weddings and celebrations children's clothing"
    },
    {
      key: 'home.occasion.eid',
      title: 'Eid & Festive Sherwanis',
      tag: 'Eastern Heritage',
      linkText: 'Shop Festive Wear →',
      href: '#sherwani',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDIr-AAEDYVwwzTvslv_ixJ1SJvguu3DHZeWKoV0HsCqtwfc8S_KKKGIb3jzEEljT3futBI6Cypt6lgDEEK6E5Wa6EEY9NYC3NhZAI1Jm3sJ-k6jOVcpOiI_2-vepAbJWBHURC-TCz1J5EUeYGre8mEEe5Q3ckuHsddEnL9sXqttGNF8E_X_GxXLv_96jgMY6M8yi3zsHozfBPgsQ4w397nIa0gdeCe7V5q6JFkOGQgXJ3_c7xF1Zjq',
      alt: "Eid and festive wear for boys"
    },
    {
      key: 'home.occasion.prince',
      title: 'Royal Prince Collection',
      tag: 'Regal Cut',
      linkText: 'View Prince Coats →',
      href: '#prince-coat',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDk-8D9UXdvwXEG-6QTj2-dLcbkWd31Onj4P0Cflaw1zif4bjtYCbhSVq95fCzC2w056P-2afAxvXLHHz9yn8h7xtCW9KJA3xsSLXR93eiBxMRBnqyC7jjnYlmVbusTvUCmSj2XWTGeKOBZNW70T8Ll2uP6ci_RsmGhLRWsJv7gYICqn3FxY7ubaRn-PBVnYm5atQ0vLdKw3_06a7Nfuf72XlWSDlyxpYjAVaKCcBLRc6XGjaQa29iK',
      alt: "Prince Coat Regal Collection"
    }
  ]
  const occasions = defaults.filter((item) => isContentEnabled(item.key)).map((item) => {
    const content = getPublishedContent(item.key)
    return content ? {
      ...item,
      title: content.headline || item.title,
      tag: content.tag || item.tag,
      linkText: content.link_text || item.linkText,
      href: content.link_href || item.href,
      image: resolveImage(content.image_key || item.key, item.image),
      alt: content.alt_text || item.alt
    } : { ...item, image: resolveImage(item.key, item.image) }
  })

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16" data-purpose="occasion-categories">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="text-xs uppercase font-semibold tracking-widest text-brand-muted block mb-1">
          {heading.tag || 'Tailored for Milestones'}
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-brand-black">
          {heading.headline || 'Made for Special Moments'}
        </h2>
        <div className="w-12 h-0.5 bg-brand-black mx-auto mt-4"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {occasions.map((occ) => (
          <div key={occ.title} className="group relative overflow-hidden bg-neutral-100 aspect-4/5 flex items-end p-8">
            <img
              alt={occ.alt}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-95"
              src={occ.image}
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="relative z-10 text-white">
              <span className="text-[10px] uppercase tracking-widest text-neutral-300 font-medium">
                {occ.tag}
              </span>
              <h3 className="text-xl font-bold mt-1 mb-2">
                {occ.title}
              </h3>
              <a
                className="text-xs font-semibold uppercase tracking-wider underline underline-offset-4 hover:text-neutral-200"
                href={occ.href}
              >
                {occ.linkText}
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}