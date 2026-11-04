import React, { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import Header from './components/Header'
import HeroBanner from './components/HeroBanner'
import CategoryShowcase from './components/CategoryShowcase'
import FeaturedProducts from './components/FeaturedProducts'
import EditorialBanners from './components/EditorialBanners'
import Testimonial from './components/Testimonial'
import FlashSales from './components/FlashSales'
import WideBanner from './components/WideBanner'
import OccasionWear from './components/OccasionWear'
import QuoteSection from './components/QuoteSection'
import JournalSection from './components/JournalSection'
import InstagramGallery from './components/InstagramGallery'
import Footer from './components/Footer'
import AnnouncementBar from './components/AnnouncementBar'
import QuickViewModal from './components/QuickViewModal'
import CartDrawer from './components/CartDrawer'
import SearchModal from './components/SearchModal'
import StorePages from './components/StorePages'
import { FEATURED_PRODUCTS, FLASH_SALE_PRODUCTS, getProductSlug } from './data/products'
import { supabase } from './lib/supabase'
import { useManagedSite } from './lib/ManagedSiteContext'
import './App.css'

const readStoredItems = (key, fallback) => {
  try {
    const savedItems = window.localStorage.getItem(key)
    const parsedItems = savedItems ? JSON.parse(savedItems) : fallback
    return Array.isArray(parsedItems) ? parsedItems : fallback
  } catch {
    return fallback
  }
}

const CATALOG_PRODUCTS = [...FEATURED_PRODUCTS, ...FLASH_SALE_PRODUCTS]
const getProductColors = (product) => (product.colors || [])
  .map((color) => typeof color === 'string' ? color : color.name)
  .filter(Boolean)

function mapDatabaseProduct(product) {
  const variants = (product.product_variants || []).filter((variant) => variant.is_active)
  const orderedImages = [...(product.product_images || [])]
    .sort((left, right) => left.sort_order - right.sort_order)
  const images = orderedImages
    .map((image) => supabase.storage.from('product-images').getPublicUrl(image.storage_path).data.publicUrl)
  const price = Number(product.sale_price ?? product.price)
  const originalPrice = product.sale_price ? Number(product.price) : null
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description || '',
    sku: product.sku,
    price,
    basePrice: Number(product.price),
    originalPrice,
    priceFormatted: `PKR ${price.toLocaleString()}`,
    originalPriceFormatted: originalPrice ? `PKR ${originalPrice.toLocaleString()}` : '',
    image: images[0] || '/favicon.svg',
    images,
    imageAltText: orderedImages[0]?.alt_text || product.name,
    imageAltTexts: orderedImages.map((image) => image.alt_text || product.name),
    isFeatured: Boolean(product.is_featured),
    category: product.categories?.name || 'Uncategorized',
    categoryId: product.category_id,
    age: product.age_range || '',
    sizes: [...new Set(variants.map((variant) => variant.size).filter(Boolean))],
    colors: [...new Set(variants.map((variant) => variant.color).filter(Boolean))],
    variants,
    inventory: variants.reduce((total, variant) => total + variant.stock_quantity, 0),
    discount: originalPrice ? `${Math.round((1 - price / originalPrice) * 100)}% OFF` : '',
    isNew: Date.now() - new Date(product.created_at).getTime() < 30 * 24 * 60 * 60 * 1000
  }
}

export default function App() {
  const { user, resendVerificationEmail } = useAuth()
  const navigate = useNavigate()
  const { assets, resolveImage, getPublishedContent, isContentEnabled } = useManagedSite()
  const userId = user?.id
  const [cartEntries, setCartEntries] = useState(() => readStoredItems('little-star-cart', [])
    .filter((item) => item && (typeof item.id === 'string' || Number.isInteger(item.id)) && Number.isInteger(item.quantity) && item.quantity > 0)
    .map((item) => ({
      id: item.id,
      quantity: item.quantity,
      selectedSize: item.selectedSize || 'Standard',
      selectedColor: item.selectedColor || '',
      variant_id: item.variant_id || null
    })))
  const [wishlistIds, setWishlistIds] = useState(() => [...new Set(
    readStoredItems('little-star-wishlist', []).filter((id) => typeof id === 'string' || Number.isInteger(id))
  )])
  const [databaseProducts, setDatabaseProducts] = useState([])
  const [catalogLoaded, setCatalogLoaded] = useState(!supabase)
  const [catalogError, setCatalogError] = useState('')
  const [cartSyncError, setCartSyncError] = useState('')
  const remoteCartUser = useRef(null)
  const [cartLoadVersion, setCartLoadVersion] = useState(0)
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#\/?/, '') || 'home')
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [quickViewProduct, setQuickViewProduct] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    supabase
      .from('products')
      .select('*, categories(name), product_images(id,storage_path,sort_order), product_variants(id,size,color,price_override,stock_quantity,is_active,sku)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error
        if (active) setDatabaseProducts((data || []).map(mapDatabaseProduct))
      })
      .catch((error) => {
        if (active) setCatalogError(error.message || 'The live product catalog could not be loaded.')
      })
      .finally(() => {
        if (active) setCatalogLoaded(true)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!userId || !catalogLoaded || !supabase) {
      remoteCartUser.current = null
      return undefined
    }
    let active = true
    remoteCartUser.current = null
    const loadCart = async () => {
      const { data: cart, error: cartError } = await supabase
        .from('carts')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      if (cartError) throw cartError
      if (cart) {
        const { data: items, error: itemsError } = await supabase
          .from('cart_items')
          .select('product_id,variant_id,quantity,product_variants(size,color)')
          .eq('cart_id', cart.id)
        if (itemsError) throw itemsError
        if (!active) return
        const savedEntries = (items || []).map((item) => ({
          id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          selectedSize: item.product_variants?.size || 'Standard',
          selectedColor: item.product_variants?.color || ''
        }))
        setCartEntries((localEntries) => {
          const merged = [...savedEntries]
          for (const localEntry of localEntries) {
            const matchingIndex = merged.findIndex((savedEntry) =>
              savedEntry.id === localEntry.id && (
                (savedEntry.variant_id && savedEntry.variant_id === localEntry.variant_id)
                || (!savedEntry.variant_id && !localEntry.variant_id
                  && savedEntry.selectedSize === localEntry.selectedSize
                  && savedEntry.selectedColor === localEntry.selectedColor)
              )
            )
            if (matchingIndex < 0) merged.push(localEntry)
            else merged[matchingIndex].quantity = Math.max(merged[matchingIndex].quantity, localEntry.quantity)
          }
          return merged
        })
      }
      if (active) {
        remoteCartUser.current = userId
        setCartLoadVersion((version) => version + 1)
      }
    }
    loadCart().catch((error) => {
      if (active) setCartSyncError(error.message || 'Your saved cart could not be loaded.')
    })
    return () => { active = false }
  }, [userId, catalogLoaded])

  useEffect(() => {
    const syncRoute = () => setRoute(window.location.hash.replace(/^#\/?/, '') || 'home')
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  const managedSampleProducts = CATALOG_PRODUCTS.map((product) => {
    const assetKey = product.id >= 100 ? `product.sale.${product.id}` : `product.sample.${product.id}`
    return { ...product, image: resolveImage(assetKey, product.image) }
  })
  const featuredProducts = FEATURED_PRODUCTS.map((product) => {
    const asset = assets.find((item) => item.asset_key === `product.sample.${product.id}`)
    return { ...product, image: resolveImage(asset?.asset_key, product.image) }
  })
  const saleProducts = FLASH_SALE_PRODUCTS.map((product) => {
    const asset = assets.find((item) => item.asset_key === `product.sale.${product.id}`)
    return { ...product, image: resolveImage(asset?.asset_key, product.image) }
  })
  const allProducts = [...databaseProducts, ...managedSampleProducts]
  const productById = new Map(allProducts.map((product) => [product.id, product]))
  const cartItems = cartEntries.flatMap((entry) => {
    const product = productById.get(entry.id)
    if (!product) return []
    const variant = product.variants?.find((item) => item.id === entry.variant_id)
    const price = Number(variant?.price_override ?? product.price)
    return [{
      ...product,
      ...entry,
      price,
      priceFormatted: `PKR ${price.toLocaleString()}`
    }]
  })

  useEffect(() => {
    window.localStorage.setItem('little-star-cart', JSON.stringify(cartEntries))
  }, [cartEntries])

  useEffect(() => {
    if (!userId || remoteCartUser.current !== userId || !supabase) return undefined
    const timer = window.setTimeout(() => {
      const items = cartEntries
        .filter((item) => typeof item.id === 'string' && item.variant_id)
        .map((item) => ({ product_id: item.id, variant_id: item.variant_id, quantity: item.quantity }))
      supabase.rpc('save_customer_cart', { p_items: items })
        .then(({ error }) => {
          if (error) throw error
          setCartSyncError('')
        })
        .catch((error) => setCartSyncError(error.message || 'Your cart could not be saved.'))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [cartEntries, userId, cartLoadVersion])

  useEffect(() => {
    window.localStorage.setItem('little-star-wishlist', JSON.stringify(wishlistIds))
  }, [wishlistIds])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  const handleAddToCart = (product, quantity = 1, selectedSize = 'Standard', selectedColor = '') => {
    const catalogProduct = productById.get(product.id)
    if (!catalogProduct) {
      showToast('This product is no longer available in the catalog.')
      return
    }
    const validSizes = catalogProduct.sizes?.length ? catalogProduct.sizes : ['Standard']
    const validColors = getProductColors(catalogProduct)
    const size = validSizes.includes(selectedSize) ? selectedSize : validSizes[0]
    const color = validColors.includes(selectedColor) ? selectedColor : validColors[0] || ''
    const selectedVariant = catalogProduct.variants?.find((variant) => variant.size === size && variant.color === color)
    const maxQuantity = selectedVariant
      ? selectedVariant.stock_quantity
      : Number.isInteger(catalogProduct.inventory) ? catalogProduct.inventory : 99
    if (catalogProduct.variants?.length && !selectedVariant) {
      showToast('This size and color combination is unavailable.')
      return
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantity) {
      showToast(`Choose a quantity between 1 and ${maxQuantity}.`)
      return
    }
    const existingEntry = cartEntries.find(
      (item) => item.id === catalogProduct.id && item.selectedSize === size && item.selectedColor === color
    )
    if (existingEntry && existingEntry.quantity + quantity > maxQuantity) {
      showToast(`The maximum quantity for this item is ${maxQuantity}.`)
      return
    }

    setCartEntries((prev) => {
      const existing = prev.find(
        (item) => item.id === catalogProduct.id && item.selectedSize === size && item.selectedColor === color
      )
      if (existing) {
        return prev.map((item) =>
          item.id === catalogProduct.id && item.selectedSize === size && item.selectedColor === color
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      return [...prev, { id: catalogProduct.id, quantity, selectedSize: size, selectedColor: color, variant_id: selectedVariant?.id || null }]
    })
    showToast(`Added "${catalogProduct.name}" to your shopping bag!`)
    setIsCartOpen(true)
  }

  const handleUpdateQuantity = (id, selectedSize, newQty, selectedColor = '') => {
    if (newQty <= 0) {
      handleRemoveItem(id, selectedSize, selectedColor)
      return
    }
    if (!Number.isInteger(newQty) || newQty < 1) return
    const product = productById.get(id)
    const entry = cartEntries.find((item) => item.id === id && item.selectedSize === selectedSize && item.selectedColor === selectedColor)
    const variant = product?.variants?.find((item) => item.id === entry?.variant_id)
    const maxQuantity = variant?.stock_quantity ?? (Number.isInteger(product?.inventory) ? product.inventory : 99)
    if (newQty > maxQuantity) {
      showToast(`The maximum quantity for this item is ${maxQuantity}.`)
      return
    }
    setCartEntries((prev) =>
      prev.map((item) =>
        item.id === id && item.selectedSize === selectedSize && item.selectedColor === selectedColor
          ? { ...item, quantity: newQty }
          : item
      )
    )
  }

  const handleRemoveItem = (id, selectedSize, selectedColor = '') => {
    setCartEntries((prev) =>
      prev.filter((item) => !(item.id === id && item.selectedSize === selectedSize && item.selectedColor === selectedColor))
    )
  }

  const handleToggleWishlist = (id) => {
    setWishlistIds((prev) => {
      const exists = prev.includes(id)
      if (exists) {
        showToast('Removed from wishlist')
        return prev.filter((item) => item !== id)
      } else {
        showToast('Saved to wishlist')
        return [...prev, id]
      }
    })
  }

  const handleSaveToWishlist = (id) => {
    setWishlistIds((prev) => prev.includes(id) ? prev : [...prev, id])
    showToast('Saved to wishlist')
  }

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0)
  const emailVerified = Boolean(user?.email_confirmed_at || user?.confirmed_at)
  const productDetailSlug = route.startsWith('product/') ? route.slice('product/'.length) : ''
  const productDetail = allProducts.find((product) => getProductSlug(product) === productDetailSlug)

  const handleCheckout = async (shippingAddress) => {
    if (!user || !supabase) throw new Error('Sign in to place your order.')
    if (!emailVerified) throw new Error('Verify your email address before placing an order.')
    if (cartItems.some((item) => !item.variant_id)) {
      throw new Error('Some items are from the sample catalog and do not have live size/color inventory. Remove those items and add products from the live catalog before checkout.')
    }
    const cartSignature = cartItems
      .map((item) => `${item.id}:${item.variant_id}:${item.quantity}`)
      .sort()
      .join('|')
    const keyStorage = `little-star-checkout-key:${user.id}:${cartSignature}`
    const idempotencyKey = window.sessionStorage.getItem(keyStorage) || crypto.randomUUID()
    window.sessionStorage.setItem(keyStorage, idempotencyKey)
    const { data, error } = await supabase.rpc('place_cod_order', {
      p_items: cartItems.map((item) => ({
        product_id: item.id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        expected_unit_price: item.price
      })),
      p_shipping_address: shippingAddress,
      p_idempotency_key: idempotencyKey
    })
    if (error) throw error
    window.sessionStorage.removeItem(keyStorage)
    setCartEntries([])
    navigate(`/account/orders/${data.id}`, { replace: true, state: { orderReceived: true } })
    return data
  }

  const handleResendVerification = async () => {
    if (!user?.email) throw new Error('Sign in with your email address before requesting a verification link.')
    await resendVerificationEmail(user.email, '/#/cart')
  }

  if (route === 'account') return <Navigate to="/account" replace />

  return (
    <div className="site-shell w-full min-h-screen bg-white text-brand-dark flex flex-col">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-brand-black text-white px-5 py-3 text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 animate-bounce">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header with Navigation (Topmost Header) */}
      <AnnouncementBar content={getPublishedContent('store.announcement')} />
      <Header
        currentRoute={route}
        wishlistCount={wishlistIds.length}
        cartCount={totalCartCount}
        onOpenCart={() => { window.location.hash = '#/cart' }}
        onOpenSearch={() => setIsSearchOpen(true)}
      />
      {(catalogError || cartSyncError) && (
        <div className="store-data-error" role="alert">{[catalogError, cartSyncError].filter(Boolean).join(' ')}</div>
      )}

      {/* Main Page Content */}
      {route === 'home' ? <main>
        {/* Hero Banner Section */}
        {(isContentEnabled('home.hero.primary') || isContentEnabled('home.hero.formal')) && <HeroBanner />}

        <CategoryShowcase products={allProducts} />

        {/* Featured Products Grid */}
        {isContentEnabled('home.featured') && <FeaturedProducts
          products={databaseProducts.filter((product) => product.isFeatured).slice(0, 4).length
            ? databaseProducts.filter((product) => product.isFeatured).slice(0, 4)
            : databaseProducts.slice(0, 4).length ? databaseProducts.slice(0, 4) : featuredProducts}
          onQuickView={(p) => setQuickViewProduct(p)}
          onAddToCart={(p, size) => handleAddToCart(p, 1, size || p.sizes?.[0] || 'Standard')}
          onToggleWishlist={handleToggleWishlist}
          wishlistIds={wishlistIds}
        />}

        {/* Editorial Banners Grid */}
        {(isContentEnabled('home.editorial.everyday') || isContentEnabled('home.editorial.formal') || isContentEnabled('home.editorial.sherwani')) && <EditorialBanners />}

        {/* Customer Testimonial Section */}
        <Testimonial />

        {/* Flash Sales with Live Countdown */}
        {isContentEnabled('home.flash-sales') && <FlashSales
          products={saleProducts}
          onQuickView={(p) => setQuickViewProduct(p)}
          onAddToCart={(p) => handleAddToCart(p, 1, p.sizes ? p.sizes[0] : 'Standard')}
          onToggleWishlist={handleToggleWishlist}
          wishlistIds={wishlistIds}
        />}

        {/* Wide Editorial Banner */}
        {isContentEnabled('home.wide-banner') && <WideBanner />}

        {/* Occasion Wear Moments */}
        {(isContentEnabled('home.occasion.wedding') || isContentEnabled('home.occasion.eid') || isContentEnabled('home.occasion.prince')) && <OccasionWear />}

        {/* Quote of the Day */}
        <QuoteSection />

        {/* Our Journal Articles */}
        {(isContentEnabled('home.journal.1') || isContentEnabled('home.journal.2') || isContentEnabled('home.journal.3')) && <JournalSection />}

        {/* Instagram Gallery Feed */}
        {(isContentEnabled('home.instagram.1') || isContentEnabled('home.instagram.2') || isContentEnabled('home.instagram.3')
          || isContentEnabled('home.instagram.4') || isContentEnabled('home.instagram.5') || isContentEnabled('home.instagram.6')) && <InstagramGallery />}
      </main> : <StorePages
        route={route}
        products={allProducts}
        cartItems={cartItems}
        wishlistIds={wishlistIds}
        productDetail={productDetail}
        onAddToCart={handleAddToCart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onToggleWishlist={handleToggleWishlist}
        onSaveToWishlist={handleSaveToWishlist}
        user={user}
        emailVerified={emailVerified}
        onResendVerification={handleResendVerification}
        onCheckout={handleCheckout}
      />}

      {/* Main Footer */}
      <Footer />

      {/* Quick View Modal */}
      {quickViewProduct && (
        <QuickViewModal
          product={quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Shopping Bag Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onSaveToWishlist={handleSaveToWishlist}
        onViewCart={() => { setIsCartOpen(false); window.location.hash = '#/cart' }}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        allProducts={allProducts}
      />

    </div>
  )
}