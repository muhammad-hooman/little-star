import React, { useEffect, useMemo, useState } from 'react'
import { useManagedSite } from '../lib/ManagedSiteContext'
import './ProductDetail.css'

const formatPrice = (amount) => `PKR ${amount.toLocaleString()}`
const fallback = 'This information has not been provided yet.'

function SizeChartModal({ onClose, image, alt }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="product-modal-backdrop" onClick={onClose}>
      <section
        className="product-size-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="size-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="product-modal-close" onClick={onClose} aria-label="Close size guide">×</button>
        <p className="product-detail-eyebrow">LITTLE STAR FIT GUIDE</p>
        <h2 id="size-guide-title">Size Chart &amp; Guide</h2>
        <img
          className="product-size-chart-image"
          src={image}
          alt={alt}
        />
      </section>
    </div>
  )
}

function ImageLightbox({ images, activeIndex, onSelect, onClose, productName }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onSelect((activeIndex + 1) % images.length)
      if (event.key === 'ArrowLeft') onSelect((activeIndex + images.length - 1) % images.length)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [activeIndex, images.length, onClose, onSelect])

  return (
    <div className="product-lightbox" role="dialog" aria-modal="true" aria-label={`${productName} image viewer`} onClick={onClose}>
      <button type="button" aria-label="Close image viewer" className="product-lightbox-close" onClick={onClose}>×</button>
      {images.length > 1 && (
        <button type="button" aria-label="Previous image" className="product-lightbox-arrow product-lightbox-previous" onClick={(event) => { event.stopPropagation(); onSelect((activeIndex + images.length - 1) % images.length) }}>‹</button>
      )}
      <img src={images[activeIndex]} alt={productName} onClick={(event) => event.stopPropagation()} />
      {images.length > 1 && (
        <button type="button" aria-label="Next image" className="product-lightbox-arrow product-lightbox-next" onClick={(event) => { event.stopPropagation(); onSelect((activeIndex + 1) % images.length) }}>›</button>
      )}
    </div>
  )
}

export default function ProductDetail({ product, wishlistIds, onAddToCart, onToggleWishlist }) {
  const { getPublishedContent, resolveImage } = useManagedSite()
  const sizeChart = getPublishedContent('size-chart')
  const sizeChartImage = resolveImage(sizeChart?.image_key || 'size-chart', '/little-star-size-chart.png')
  const images = useMemo(() => {
    const productImages = product.images?.length ? product.images : [product.image]
    return [...new Set(productImages.filter(Boolean))]
  }, [product.image, product.images])
  const sizes = product.sizes || []
  const colors = product.colors || []
  const hasSizeOptions = sizes.length > 0
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedColor, setSelectedColor] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('description')
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [validationMessage, setValidationMessage] = useState('')
  const isWishlisted = wishlistIds.includes(product.id)
  const selectedVariant = product.variants?.find((variant) =>
    variant.size === selectedSize && variant.color === selectedColor
  )
  const hasSelectedVariant = Boolean(selectedSize && selectedColor && product.variants?.length)
  const maxQuantity = hasSelectedVariant
    ? selectedVariant?.stock_quantity ?? 0
    : Number.isInteger(product.inventory) ? Math.max(0, product.inventory) : 99
  const displayPrice = selectedVariant?.price_override ?? product.price
  const selectedImageOrder = [images[activeImage], ...images.filter((_, index) => index !== activeImage)]
  const hasInventory = Number.isInteger(product.inventory)
  const isOutOfStock = hasSelectedVariant ? maxQuantity === 0 : hasInventory && product.inventory === 0

  const updateQuantity = (nextQuantity) => {
    if (!Number.isInteger(nextQuantity) || nextQuantity < 1 || nextQuantity > maxQuantity) {
      setValidationMessage(`Choose a quantity between 1 and ${maxQuantity}.`)
      return
    }
    setQuantity(nextQuantity)
    setValidationMessage('')
  }

  const handleAddToCart = () => {
    if (hasSizeOptions && !selectedSize) {
      setValidationMessage('Please select a size before adding this item to your bag.')
      return
    }
    if (colors.length > 0 && !selectedColor) {
      setValidationMessage('Please select a color before adding this item to your bag.')
      return
    }
    if (quantity < 1 || quantity > maxQuantity) {
      setValidationMessage(`Choose a quantity between 1 and ${maxQuantity}.`)
      return
    }
    setValidationMessage('')
    onAddToCart(product, quantity, selectedSize || 'Standard', selectedColor)
  }

  const description = product.description || ''
  const descriptionIsLong = description.length > 260
  const tabContent = {
    description: (
      <div className="product-description">
        {description ? (
          <>
            <p>{descriptionIsLong && !showFullDescription ? `${description.slice(0, 260).trimEnd()}…` : description}</p>
            {descriptionIsLong && (
              <button type="button" className="product-show-more" onClick={() => setShowFullDescription((shown) => !shown)}>
                Show {showFullDescription ? 'Less' : 'More'}
              </button>
            )}
          </>
        ) : <p className="product-detail-muted">{fallback}</p>}
        <dl className="product-specifications">
          {product.category && <div><dt>Category</dt><dd>{product.category}</dd></div>}
          {product.age && <div><dt>Age range</dt><dd>{product.age}</dd></div>}
          {product.fabric && <div><dt>Fabric</dt><dd>{product.fabric}</dd></div>}
          {product.sku && <div><dt>SKU</dt><dd>{product.sku}</dd></div>}
          {product.specifications?.map((specification) => (
            <div key={specification.label}><dt>{specification.label}</dt><dd>{specification.value}</dd></div>
          ))}
        </dl>
      </div>
    ),
    returns: <p className="product-tab-copy">{product.returnsPolicy || fallback}</p>,
    care: <p className="product-tab-copy">{product.careInstructions || fallback}</p>
  }

  return (
    <main className="store-page product-detail-page">
      <div className="store-breadcrumb">
        <a href="#/">Home</a><span>/</span><a href="#/new-arrivals">Shop</a><span>/</span><span>{product.name}</span>
      </div>

      <div className="product-detail-grid">
        <section className="product-gallery" aria-label={`${product.name} images`}>
          <div className="product-gallery-grid">
            {selectedImageOrder.map((image, index) => {
              const imageIndex = images.indexOf(image)
              return (
                <button
                  className={`product-gallery-image ${index === 0 ? 'product-gallery-image-primary' : ''}`}
                  type="button"
                  key={`${image}-${imageIndex}`}
                  onClick={() => { setActiveImage(imageIndex); setIsLightboxOpen(true) }}
                  aria-label={`Enlarge ${product.name} image ${imageIndex + 1}`}
                >
                  <img src={image} alt={product.imageAltTexts?.[imageIndex] || `${product.name}${images.length > 1 ? `, view ${imageIndex + 1}` : ''}`} />
                  <span aria-hidden="true">＋</span>
                </button>
              )
            })}
          </div>
          {images.length > 1 && (
            <div className="product-gallery-thumbnails" aria-label="Choose product image">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  className={index === activeImage ? 'is-selected' : ''}
                  onClick={() => setActiveImage(index)}
                  aria-label={`Show image ${index + 1}`}
                  aria-pressed={index === activeImage}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="product-detail-information">
          <div className="product-detail-heading">
            <div>
              {product.category && <p className="product-detail-eyebrow">{product.category}</p>}
              <h1>{product.name}</h1>
            </div>
            <div className="product-detail-price">
              <strong>{formatPrice(displayPrice)}</strong>
              {!selectedVariant && product.originalPrice && <del>{formatPrice(product.originalPrice)}</del>}
            </div>
          </div>

          <div className="product-detail-meta">
            {product.age && <span>{product.age}</span>}
            {product.fabric && <span>{product.fabric}</span>}
            {product.sku && <span>SKU: {product.sku}</span>}
          </div>

          {hasSizeOptions && (
            <div className="product-option-section">
              <div className="product-option-heading">
                <span>Size{selectedSize ? `: ${selectedSize}` : ''}</span>
                <button type="button" className="product-size-guide-link" onClick={() => setIsSizeChartOpen(true)}>Size Chart &amp; Guide</button>
              </div>
              <div className="product-option-buttons">
                {sizes.map((size) => (
                  <button
                    type="button"
                    key={size}
                    className={selectedSize === size ? 'is-selected' : ''}
                    onClick={() => { setSelectedSize(size); setValidationMessage('') }}
                    aria-pressed={selectedSize === size}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {colors.length > 0 && (
            <div className="product-option-section">
              <div className="product-option-heading"><span>Color{selectedColor ? `: ${selectedColor}` : ''}</span></div>
              <div className="product-option-buttons">
                {colors.map((color) => {
                  const colorName = typeof color === 'string' ? color : color.name
                  return (
                    <button
                      type="button"
                      key={colorName}
                      className={selectedColor === colorName ? 'is-selected' : ''}
                      onClick={() => setSelectedColor(colorName)}
                      aria-pressed={selectedColor === colorName}
                    >
                      {colorName}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="product-detail-stock" role="status">
            {isOutOfStock ? 'Currently out of stock' : hasSelectedVariant ? 'In stock' : hasInventory ? 'In stock' : 'Stock availability has not been provided.'}
          </div>

          <div className="product-purchase-row">
            <div className="product-quantity" aria-label="Quantity">
              <button type="button" aria-label="Decrease quantity" onClick={() => updateQuantity(quantity - 1)} disabled={quantity <= 1}>−</button>
              <input
                aria-label="Quantity"
                type="number"
                min="1"
                max={maxQuantity}
                value={quantity}
                onChange={(event) => updateQuantity(Number(event.target.value))}
              />
              <button type="button" aria-label="Increase quantity" onClick={() => updateQuantity(quantity + 1)} disabled={quantity >= maxQuantity}>+</button>
            </div>
            <button type="button" className="product-add-button" onClick={handleAddToCart} disabled={isOutOfStock || maxQuantity === 0}>
              Add to Cart
            </button>
            <button
              type="button"
              className={`product-wishlist-button ${isWishlisted ? 'is-saved' : ''}`}
              onClick={() => onToggleWishlist(product.id)}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={isWishlisted}
            >
              {isWishlisted ? '♥' : '♡'}
            </button>
          </div>
          {validationMessage && <p className="product-validation-message" role="alert">{validationMessage}</p>}

          <div className="product-delivery-note">
            <span aria-hidden="true">◇</span>
            <p>Free nationwide express delivery on orders over PKR 10,000. Shipping below this amount is confirmed at checkout.</p>
          </div>

          <section className="product-information-tabs" aria-label="Product information">
            <div className="product-tab-list" role="tablist" aria-label="Product information tabs">
              {[
                ['description', 'Description'],
                ['returns', 'Returns & Exchange'],
                ['care', 'Care Instructions']
              ].map(([tab, label]) => (
                <button
                  type="button"
                  role="tab"
                  key={tab}
                  id={`product-tab-${tab}`}
                  aria-controls={`product-panel-${tab}`}
                  aria-selected={activeTab === tab}
                  className={activeTab === tab ? 'is-active' : ''}
                  onClick={() => setActiveTab(tab)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              className="product-tab-panel"
              role="tabpanel"
              id={`product-panel-${activeTab}`}
              aria-labelledby={`product-tab-${activeTab}`}
            >
              {tabContent[activeTab]}
            </div>
          </section>
        </section>
      </div>

      {isSizeChartOpen && <SizeChartModal
        onClose={() => setIsSizeChartOpen(false)}
        image={sizeChartImage}
        alt={sizeChart?.alt_text || "Official LITTLE STAR children's clothing size chart"}
      />}
      {isLightboxOpen && images.length > 0 && (
        <ImageLightbox
          images={images}
          activeIndex={activeImage}
          onSelect={setActiveImage}
          onClose={() => setIsLightboxOpen(false)}
          productName={product.name}
        />
      )}
    </main>
  )
}
