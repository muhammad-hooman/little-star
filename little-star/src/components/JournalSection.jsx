import React from 'react'
import { JOURNAL_POSTS } from '../data/products'
import { useManagedSite } from '../lib/ManagedSiteContext'

export default function JournalSection() {
  const { getPublishedContent, getPublishedRows, resolveImage, isContentEnabled } = useManagedSite()
  const heading = getPublishedContent('home.journal.heading') || {}
  const journalOrder = new Map(getPublishedRows('section')
    .filter((row) => row.content_key.startsWith('home.journal.') && row.content_key !== 'home.journal.heading')
    .map((row, index) => [Number(row.content_key.split('.').at(-1)), index]))
  const posts = JOURNAL_POSTS
    .filter((post) => isContentEnabled(`home.journal.${post.id}`))
    .sort((left, right) => (journalOrder.get(left.id) ?? left.id) - (journalOrder.get(right.id) ?? right.id))
    .map((post) => {
    const content = getPublishedContent(`home.journal.${post.id}`)
    return content ? {
      ...post,
      date: content.date || post.date,
      category: content.category || post.category,
      title: content.headline || post.title,
      summary: content.description || post.summary,
      image: resolveImage(content.image_key, post.image)
    } : { ...post, image: resolveImage(`journal.${post.id}`, post.image) }
  })
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20" data-purpose="journal-articles" id="journal">
      <div className="flex items-center justify-between mb-10 pb-4 border-b border-brand-border">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-brand-black">{heading.headline || 'Our Journal'}</h2>
          <p className="text-xs text-brand-gray mt-1">{heading.description || 'Style guides, styling tips & festive inspirations'}</p>
        </div>
        <a className="text-xs font-semibold uppercase tracking-wider text-brand-black hover:text-neutral-600 flex items-center gap-1 group" href="#all-articles">
          All Articles
          <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {posts.map((post) => (
          <article key={post.id} className="group cursor-pointer">
            <div className="aspect-16/10 overflow-hidden bg-neutral-100 mb-4">
              <img
                alt={post.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                src={post.image}
              />
            </div>
            <div className="flex items-center gap-3 text-[11px] text-brand-muted uppercase tracking-wider mb-2">
              <span className="font-bold text-brand-black">{post.date}</span>
              <span>•</span>
              <span>{post.category}</span>
            </div>
            <h3 className="text-base font-bold text-brand-dark group-hover:text-neutral-600 transition-colors leading-snug">
              {post.title}
            </h3>
            <p className="text-xs text-brand-gray mt-2 line-clamp-2">
              {post.summary}
            </p>
            <span className="inline-block text-xs font-semibold text-brand-black mt-3 group-hover:underline">
              Read Article →
            </span>
          </article>
        ))}
      </div>
    </section>
  )
}