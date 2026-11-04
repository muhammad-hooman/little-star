import React, { useState } from 'react'
import './StorePages.css'
import ProductDetail from './ProductDetail'
import { getProductHref } from '../data/products'

const formatPrice = (amount) => `PKR ${amount.toLocaleString()}`

const COLLECTIONS = {
  'new-arrivals': {
    title: 'New Arrivals',
    description: 'The latest pieces from LITTLE STAR.',
    matches: (product) => product.isNew
  },
  'casual-dressing': {
    title: 'Casual Dressing',
    description: 'Considered comfort for everyday adventures.',
    matches: (product) => product.category === 'Casual Dressing' || /casual/i.test(product.name)
  },
  'coat-pant': {
    title: 'Coat Pant',
    description: 'Tailored occasionwear for little gentlemen.',
    matches: (product) => product.category === 'Coat Pant' || /coat pant/i.test(product.name)
  },
  sherwani: {
    title: 'Sherwani',
    description: 'Traditional craftsmanship for memorable occasions.',
    matches: (product) => /sherwani/i.test(product.name)
  },
  'prince-coat': {
    title: 'Prince Coat',
    description: 'Ceremonial pieces with a distinguished finish.',
    matches: (product) => product.category === 'Prince Coat' || /prince coat/i.test(product.name)
  },
  sale: {
    title: 'Sale',
    description: 'Selected pieces from the LITTLE STAR collection.',
    matches: (product) => Boolean(product.discount)
  }
}

function Breadcrumb({ current }) {
  return (
    <div className="store-breadcrumb">
      <a href="#/">Home</a><span>/</span><span>{current}</span>
    </div>
  )
}

function StoreHeading({ title, description, count }) {
  return (
    <div className="store-heading">
      <div>
        <p className="store-eyebrow">LITTLE STAR COLLECTION</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {count !== undefined && <span className="store-count">{count} {count === 1 ? 'piece' : 'pieces'}</span>}
    </div>
  )
}

function ProductCard({ product, onAddToCart, onToggleWishlist, isWishlisted, onRemoveFromWishlist }) {
  const [size, setSize] = useState(product.sizes?.[0] || 'Standard')
  const [color, setColor] = useState(product.colors?.[0] || '')

  return (
    <article
      className="store-product"
      onClick={(event) => {
        if (event.target.closest('a, button, input, select, textarea')) return
        window.location.hash = getProductHref(product)
      }}
    >
      <div className="store-product-image">
        <a className="store-product-image-link" href={getProductHref(product)} aria-label={`View ${product.name}`}>
          <img src={product.image} alt={product.imageAltText || product.name} loading="lazy" />
        </a>
        {product.isNew && <span className="store-product-label">New</span>}
        {product.discount && <span className="store-product-label store-product-label-sale">{product.discount}</span>}
        <button
          className={`store-heart ${isWishlisted ? 'is-saved' : ''}`}
          type="button"
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          onClick={() => onToggleWishlist(product.id)}
        >
          {isWishlisted ? '♥' : '♡'}
        </button>
      </div>
      <div className="store-product-copy">
        <p className="store-product-age">{product.age || 'LITTLE STAR'}</p>
        <h2><a href={getProductHref(product)}>{product.name}</a></h2>
        <p className="store-product-price">
          {formatPrice(product.price)}
          {product.originalPrice && <span>{formatPrice(product.originalPrice)}</span>}
        </p>
        <label className="store-size-label">
          Size
          <select value={size} onChange={(event) => setSize(event.target.value)} aria-label={`Select size for ${product.name}`}>
            {(product.sizes || ['Standard']).map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <div className="store-product-actions">
          {product.colors?.length > 1 && <label className="store-size-label">Color<select value={color} onChange={(event) => setColor(event.target.value)} aria-label={`Select color for ${product.name}`}>{product.colors.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>}
          <button className="store-button store-button-dark" type="button" onClick={() => onAddToCart(product, 1, size, color)}>Add to Bag</button>
          {onRemoveFromWishlist && <button className="store-text-button" type="button" onClick={() => onRemoveFromWishlist(product.id)}>Remove</button>}
        </div>
      </div>
    </article>
  )
}

function CollectionPage({ route, products, wishlistIds, onAddToCart, onToggleWishlist }) {
  const collection = COLLECTIONS[route]
  const collectionProducts = products.filter(collection.matches)
  return (
    <main className="store-page">
      <Breadcrumb current={collection.title} />
      <StoreHeading title={collection.title} description={collection.description} count={collectionProducts.length} />
      {collectionProducts.length ? (
        <div className="store-product-grid">
          {collectionProducts.map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} isWishlisted={wishlistIds.includes(product.id)} />
          ))}
        </div>
      ) : (
        <div className="store-empty"><h2>Nothing to show just yet</h2><p>There are no listed pieces in this collection right now.</p><a className="store-button store-button-dark" href="#/">Continue browsing</a></div>
      )}
    </main>
  )
}

function CartPage({ cartItems, onUpdateQuantity, onRemoveItem, onSaveToWishlist, user, emailVerified, onResendVerification, onCheckout }) {
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const qualifiesForFreeShipping = subtotal >= 10000
  const shipping = qualifiesForFreeShipping ? 0 : 500
  const [checkoutStep, setCheckoutStep] = useState('details')
  const [checkoutDetails, setCheckoutDetails] = useState(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutNotice, setCheckoutNotice] = useState('')

  const reviewCheckout = (event) => {
    event.preventDefault()
    setCheckoutError('')
    const values = new FormData(event.currentTarget)
    setCheckoutDetails({
      full_name: String(values.get('full_name') || '').trim(),
      phone: String(values.get('phone') || '').trim(),
      alternate_phone: String(values.get('alternate_phone') || '').trim(),
      province: String(values.get('province') || '').trim(),
      city: String(values.get('city') || '').trim(),
      area: String(values.get('area') || '').trim(),
      address_line1: String(values.get('address_line1') || '').trim(),
      house_landmark: String(values.get('house_landmark') || '').trim(),
      delivery_instructions: String(values.get('delivery_instructions') || '').trim()
    })
    setCheckoutStep('review')
  }

  const placeOrder = async () => {
    if (!checkoutDetails) return
    setCheckoutBusy(true)
    setCheckoutError('')
    setCheckoutNotice('')
    try {
      await onCheckout(checkoutDetails)
    } catch (error) {
      setCheckoutError(error.message || 'Your order could not be placed.')
      setCheckoutBusy(false)
    }
  }

  const resendVerification = async () => {
    setCheckoutNotice('')
    setCheckoutError('')
    setResendBusy(true)
    try {
      await onResendVerification()
      setCheckoutNotice('A verification email has been requested. Check your inbox and spam folder.')
    } catch (error) {
      setCheckoutError(error.message || 'The verification email could not be requested.')
    } finally {
      setResendBusy(false)
    }
  }

  return (
    <main className="store-page">
      <Breadcrumb current="Shopping Cart" />
      <StoreHeading title="Shopping Cart" description="Review your selected pieces before checkout." count={cartItems.reduce((sum, item) => sum + item.quantity, 0)} />
      {!cartItems.length ? (
        <div className="store-empty"><h2>Your bag is empty</h2><p>Explore the collection and find something special.</p><a className="store-button store-button-dark" href="#/new-arrivals">Continue shopping</a></div>
      ) : (
        <div className="store-cart-layout">
          <section className="store-cart-list" aria-label="Cart items">
            {cartItems.map((item) => (
              <article className="store-cart-row" key={`${item.id}-${item.selectedSize}-${item.selectedColor || ''}`}>
                <img src={item.image} alt={item.name} />
                <div className="store-cart-details">
                  <h2>{item.name}</h2>
                  <p>Size: {item.selectedSize || 'Standard'}</p>
                  {item.selectedColor && <p>Color: {item.selectedColor}</p>}
                  <p className="store-cart-price">{formatPrice(item.price)}</p>
                  <div className="store-cart-row-actions">
                    <div className="store-quantity" aria-label={`Quantity for ${item.name}`}>
                      <button type="button" aria-label="Decrease quantity" onClick={() => onUpdateQuantity(item.id, item.selectedSize, item.quantity - 1, item.selectedColor)}>−</button>
                      <span>{item.quantity}</span>
                      <button type="button" aria-label="Increase quantity" onClick={() => onUpdateQuantity(item.id, item.selectedSize, item.quantity + 1, item.selectedColor)}>+</button>
                    </div>
                    <button className="store-text-button" type="button" onClick={() => onSaveToWishlist(item.id)}>Save to wishlist</button>
                    <button className="store-text-button" type="button" onClick={() => onRemoveItem(item.id, item.selectedSize, item.selectedColor)}>Remove</button>
                  </div>
                </div>
                <strong className="store-line-total">{formatPrice(item.price * item.quantity)}</strong>
              </article>
            ))}
            <a className="store-continue-link" href="#/new-arrivals">← Continue shopping</a>
          </section>
          <aside className="store-summary">
            <h2>Order Summary</h2>
            <div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
            <div><span>Shipping</span><strong>{qualifiesForFreeShipping ? 'Free' : formatPrice(shipping)}</strong></div>
            <div><span>Promo discount</span><strong>{formatPrice(0)}</strong></div>
            <div className="store-summary-total"><span>Estimated total</span><strong>{formatPrice(subtotal + shipping)}</strong></div>
            <p className="store-summary-note">{qualifiesForFreeShipping ? 'Free nationwide express delivery applied.' : 'PKR 500 nationwide express delivery applies below PKR 10,000.'}</p>
            {checkoutNotice && <p className="store-account-notice" role="status">{checkoutNotice}</p>}
            {!user ? (
              <a className="store-button store-button-dark store-button-wide" href={`/login?next=${encodeURIComponent('/#/cart')}`}>Sign in to checkout</a>
            ) : !emailVerified ? (
              <div className="store-account-notice">
                <p>Verify {user.email || 'your email address'} before placing an order.</p>
                <button className="store-button store-button-dark store-button-wide" type="button" onClick={resendVerification} disabled={resendBusy}>
                  {resendBusy ? 'Requesting email…' : 'Resend verification email'}
                </button>
              </div>
            ) : (
              <button className="store-button store-button-dark store-button-wide" type="button" onClick={() => { setCheckoutStep('details'); setCheckoutError(''); setCheckoutNotice('') }}>
                Continue to secure checkout
              </button>
            )}
            {user && emailVerified && checkoutStep === 'details' && (
              <form className="store-account-form store-checkout-form" onSubmit={reviewCheckout}>
                {checkoutError && <p className="auth-feedback auth-feedback-error" role="alert">{checkoutError}</p>}
                <p className="store-checkout-email">Verified email: <strong>{user.email}</strong></p>
                <label>Full name<input name="full_name" autoComplete="name" maxLength="120" required defaultValue={user.user_metadata?.full_name || ''} /></label>
                <label>Phone number<input name="phone" type="tel" autoComplete="tel" maxLength="32" required defaultValue={user.user_metadata?.phone || ''} /></label>
                <label>Alternate phone <span className="store-checkout-optional">Optional</span><input name="alternate_phone" type="tel" maxLength="32" /></label>
                <label>Province
                  <select name="province" autoComplete="address-level1" required defaultValue="">
                    <option value="" disabled>Select province / territory</option>
                    {['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory', 'Gilgit-Baltistan', 'Azad Jammu and Kashmir'].map((province) => <option key={province} value={province}>{province}</option>)}
                  </select>
                </label>
                <label>City<input name="city" autoComplete="address-level2" maxLength="100" required /></label>
                <label>Area / neighborhood<input name="area" maxLength="120" required /></label>
                <label>Street address<input name="address_line1" autoComplete="street-address" maxLength="240" required /></label>
                <label>House, apartment or landmark<input name="house_landmark" maxLength="160" required /></label>
                <label>Delivery instructions <span className="store-checkout-optional">Optional</span><textarea name="delivery_instructions" rows="3" maxLength="500" /></label>
                <fieldset className="store-payment-options">
                  <legend>Payment method</legend>
                  <label><input type="radio" name="payment_method" value="cod" defaultChecked /> Cash on Delivery</label>
                  <label className="store-payment-unavailable"><input type="radio" name="payment_method" value="easypaisa" disabled /> Easypaisa <span>Unavailable until verified merchant checkout is configured</span></label>
                </fieldset>
                <button className="store-button store-button-dark store-button-wide" type="submit">
                  Review order · {formatPrice(subtotal + shipping)}
                </button>
              </form>
            )}
            {user && emailVerified && checkoutStep === 'review' && checkoutDetails && (
              <section className="store-checkout-review" aria-label="Review your order">
                <h3>Review delivery details</h3>
                <p>{checkoutDetails.full_name}<br />{checkoutDetails.phone}{checkoutDetails.alternate_phone && ` · ${checkoutDetails.alternate_phone}`}<br />{checkoutDetails.house_landmark}, {checkoutDetails.address_line1}<br />{checkoutDetails.area}, {checkoutDetails.city}, {checkoutDetails.province}</p>
                {checkoutDetails.delivery_instructions && <p>Instructions: {checkoutDetails.delivery_instructions}</p>}
                <h3>Items</h3>
                {cartItems.map((item) => <p key={`${item.id}-${item.variant_id}`}>{item.name} · {item.selectedSize} {item.selectedColor && `· ${item.selectedColor}`} × {item.quantity} <strong>{formatPrice(item.price * item.quantity)}</strong></p>)}
                <p className="store-summary-total"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></p>
                <p><span>Delivery</span><strong>{shipping ? formatPrice(shipping) : 'Free'}</strong></p>
                <p className="store-summary-total"><span>Pay on delivery</span><strong>{formatPrice(subtotal + shipping)}</strong></p>
                <p className="store-summary-note">Cash on Delivery · Payment remains unpaid until collected. Prices and stock will be rechecked securely before placing the order.</p>
                {checkoutError && <p className="auth-feedback auth-feedback-error" role="alert">{checkoutError}</p>}
                {checkoutError.toLowerCase().includes('price changed') && <button className="store-text-button" type="button" onClick={() => window.location.reload()}>Refresh current prices and review again</button>}
                <button className="store-button store-button-dark store-button-wide" type="button" onClick={placeOrder} disabled={checkoutBusy}>
                  {checkoutBusy ? 'Placing order…' : `Place COD order · ${formatPrice(subtotal + shipping)}`}
                </button>
                <button className="store-text-button store-edit-link" type="button" disabled={checkoutBusy} onClick={() => setCheckoutStep('details')}>Edit delivery details</button>
              </section>
            )}
          </aside>
        </div>
      )}
    </main>
  )
}

function WishlistPage({ products, wishlistIds, onAddToCart, onToggleWishlist }) {
  const items = products.filter((product) => wishlistIds.includes(product.id))
  return (
    <main className="store-page">
      <Breadcrumb current="Wishlist" />
      <StoreHeading title="Your Wishlist" description="Pieces you have saved for later." count={items.length} />
      {items.length ? (
        <div className="store-product-grid">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} isWishlisted onRemoveFromWishlist={onToggleWishlist} />
          ))}
        </div>
      ) : (
        <div className="store-empty"><h2>Your wishlist is empty</h2><p>Save pieces here as you browse the collections.</p><a className="store-button store-button-dark" href="#/new-arrivals">Explore collections</a></div>
      )}
    </main>
  )
}

export default function StorePages({ route, products, cartItems, wishlistIds, productDetail, onAddToCart, onUpdateQuantity, onRemoveItem, onToggleWishlist, onSaveToWishlist, user, emailVerified, onResendVerification, onCheckout }) {
  if (route.startsWith('product/')) {
    return productDetail
      ? <ProductDetail key={productDetail.id} product={productDetail} wishlistIds={wishlistIds} onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} />
      : <main className="store-page"><Breadcrumb current="Page not found" /><div className="store-empty"><h1>Product not found</h1><a className="store-button store-button-dark" href="#/new-arrivals">Browse products</a></div></main>
  }
  if (COLLECTIONS[route]) return <CollectionPage route={route} products={products} wishlistIds={wishlistIds} onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} />
  if (route === 'cart') return <CartPage cartItems={cartItems} onUpdateQuantity={onUpdateQuantity} onRemoveItem={onRemoveItem} onSaveToWishlist={onSaveToWishlist} user={user} emailVerified={emailVerified} onResendVerification={onResendVerification} onCheckout={onCheckout} />
  if (route === 'wishlist') return <WishlistPage products={products} wishlistIds={wishlistIds} onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} />
  return <main className="store-page"><Breadcrumb current="Page not found" /><div className="store-empty"><h1>Page not found</h1><a className="store-button store-button-dark" href="#/">Return home</a></div></main>
}