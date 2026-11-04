import React, { useState } from 'react'
import { getProductHref } from '../data/products'
import { useManagedSite } from '../lib/ManagedSiteContext'

function FeaturedProductCard({ product, onQuickView, onAddToCart, onToggleWishlist, isWishlisted }) {
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] || 'Standard')
  return (
    <article className="ls-product-card" data-purpose="product-card">
      <a className="ls-product-image" href={getProductHref(product)} aria-label={`View ${product.name}`}>
        <img src={product.image} alt={product.imageAltText || product.name} loading="lazy" />
        {product.isNew && <span className="ls-product-badge">New arrival</span>}
        {product.discount && <span className="ls-product-badge ls-product-sale">{product.discount}</span>}
      </a>
      <button type="button" aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
        aria-pressed={isWishlisted} className={`ls-product-heart ${isWishlisted ? 'is-saved' : ''}`}
        onClick={() => onToggleWishlist(product.id)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="M20.8 8.7c0 5.4-8.8 11-8.8 11s-8.8-5.6-8.8-11A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" /></svg>
      </button>
      <div className="ls-product-copy">
        <p className="ls-product-meta">{product.age || product.category || 'LITTLE STAR'}</p>
        <h3><a href={getProductHref(product)}>{product.name}</a></h3>
        {product.description && <p className="ls-product-description">{product.description}</p>}
        <div className="ls-product-price">
          <strong>{product.priceFormatted}</strong>
          {product.originalPriceFormatted && <del>{product.originalPriceFormatted}</del>}
        </div>
        <div className="ls-product-actions">
          <label>
            <span>Age size</span>
            <select value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)} aria-label={`Choose age size for ${product.name}`}>
              {(product.sizes?.length ? product.sizes : ['Standard']).map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <button type="button" className="ls-quick-add" onClick={() => onAddToCart(product, selectedSize)}>
            <span aria-hidden="true">＋</span> Add to bag
          </button>
          <button type="button" className="ls-quick-view" onClick={() => onQuickView(product)}>Quick view</button>
        </div>
      </div>
    </article>
  )
}

export default function FeaturedProducts({ products, onQuickView, onAddToCart, onToggleWishlist, wishlistIds }) {
  const { getPublishedContent } = useManagedSite()
  const content = getPublishedContent('home.featured') || {}
  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))]
  const [activeCategory, setActiveCategory] = useState('all')
  const visibleProducts = activeCategory === 'all'
    ? products
    : products.filter((product) => product.category === activeCategory)

  return (
    <section className="ls-featured" id="featured-collection">
      <div className="ls-featured-heading">
        <div>
          <span className="ls-eyebrow">Heirloom pieces, selected for you</span>
          <h2>{content.headline || 'Most coveted pieces'}</h2>
          <p>{content.description || 'Explore the latest pieces from the LITTLE STAR collection.'}</p>
        </div>
        <a className="ls-text-link" href="#/new-arrivals">View all products <span aria-hidden="true">→</span></a>
      </div>
      {categories.length > 1 && <div className="ls-product-filters" aria-label="Filter products by category">
        <button type="button" className={activeCategory === 'all' ? 'is-active' : ''} aria-pressed={activeCategory === 'all'} onClick={() => setActiveCategory('all')}>All designs</button>
        {categories.map((category) => <button type="button" key={category} className={activeCategory === category ? 'is-active' : ''} aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)}>{category}</button>)}
      </div>}
      <div className="ls-products-grid">
        {visibleProducts.map((product) => <FeaturedProductCard key={product.id} product={product}
          onQuickView={onQuickView} onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist}
          isWishlisted={wishlistIds.includes(product.id)} />)}
      </div>
      {!visibleProducts.length && <p className="ls-empty-products">No products are available in this collection yet.</p>}
      <div className="ls-featured-more"><a href="#/new-arrivals">Discover the full collection <span aria-hidden="true">→</span></a></div>
    </section>
  )
}