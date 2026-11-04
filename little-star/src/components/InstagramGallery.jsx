import React from 'react'
import { INSTAGRAM_IMAGES } from '../data/products'
import { useManagedSite } from '../lib/ManagedSiteContext'

export default function InstagramGallery() {
  const { getPublishedRows, getPublishedContent, resolveImage, content } = useManagedSite()
  const heading = getPublishedContent('home.instagram.heading') || {}
  const managedRows = getPublishedRows('section').filter((row) => row.content_key.startsWith('home.instagram.'))
  const hasManagedRows = content.some((row) => row.content_key.startsWith('home.instagram.'))
  const images = managedRows.length
    ? managedRows.map((row) => ({
        src: resolveImage(row.payload.image_key, INSTAGRAM_IMAGES[0]),
        alt: row.payload.alt_text || 'Instagram community image'
      }))
    : hasManagedRows ? [] : INSTAGRAM_IMAGES.map((src, index) => ({
        src: resolveImage(`instagram.${index + 1}`, src),
        alt: `Instagram community ${index + 1}`
      }))
  if (!images.length) return null
  return (
    <section className="border-t border-brand-border pt-12 pb-16 bg-[#FAFAFA]" data-purpose="instagram-feed">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <span className="text-xs uppercase font-semibold tracking-widest text-brand-muted">
            {heading.tag || 'Follow Our Little Stars'}
          </span>
          <h3 className="text-xl font-bold tracking-tight text-brand-black mt-1">
            <a href={heading.instagram_url || 'https://instagram.com'} target="_blank" rel="noreferrer" className="hover:underline">
              {heading.headline || '@littlestar.pk'}
            </a>
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {images.map((image, idx) => (
            <div key={`${image.src}-${idx}`} className="aspect-square overflow-hidden group relative">
              <img
                alt={image.alt}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                src={image.src}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"></path>
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}