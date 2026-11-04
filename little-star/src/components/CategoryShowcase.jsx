import React from 'react'

const COLLECTIONS = [
  {
    title: 'Coat Pant',
    href: '#/coat-pant',
    matches: (product) => product.category === 'Coat Pant' || /coat.?pant|tuxedo/i.test(product.name)
  },
  {
    title: 'Sherwani',
    href: '#/sherwani',
    matches: (product) => /sherwani/i.test(product.name)
  },
  {
    title: 'Prince Coat',
    href: '#/prince-coat',
    matches: (product) => product.category === 'Prince Coat' || /prince coat/i.test(product.name)
  },
  {
    title: 'Casual Dressing',
    href: '#/casual-dressing',
    matches: (product) => product.category === 'Casual Dressing' || /casual/i.test(product.name)
  }
]

export default function CategoryShowcase({ products }) {
  const collections = COLLECTIONS.flatMap((collection) => {
    const product = products.find(collection.matches)
    return product ? [{ ...collection, product }] : []
  })

  if (!collections.length) return null

  return (
    <section className="ls-category-showcase" aria-labelledby="ls-category-title">
      <div className="ls-section-heading">
        <div>
          <span className="ls-eyebrow">The sartorial spectrum</span>
          <h2 id="ls-category-title">Shop by category</h2>
        </div>
        <a href="#/new-arrivals" className="ls-text-link">View all collections <span aria-hidden="true">→</span></a>
      </div>
      <div className="ls-category-rail">
        {collections.map(({ title, href, product }) => (
          <a className="ls-category-card" href={href} key={title}>
            <div className="ls-category-image">
              <img src={product.image} alt={product.imageAltText || product.name} loading="lazy" />
              <span className="ls-category-arrow" aria-hidden="true">↗</span>
            </div>
            <div className="ls-category-caption">
              <span>{title}</span>
              <small>{product.name}</small>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}