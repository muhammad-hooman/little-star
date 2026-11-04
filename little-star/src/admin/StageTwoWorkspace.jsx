import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { exportCsv } from './exportCsv'
import { validateProductImage } from './productImageValidation'

const PAGE_SIZE = 10
const SIZES = ['0-3M', '3-6M', '6-9M', '9-12M', '1-2Y', '2-3Y', '3-4Y', '4-5Y', '5-6Y', '6-7Y', '7-8Y', '8-9Y', '9-10Y', '10-11Y', '11-12Y', '12-13Y']
const PRICE_FORMAT = new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })
const blankProduct = {
  name: '', description: '', sku: '', price: '', sale_price: '', age_range: '',
  category_id: '', status: 'draft', is_featured: false, sizes: ['2-3Y', '4-5Y'], colors: ['Navy']
}
const PRODUCT_TABLES = [
  ['products', 'products', '*, categories(id,name), product_images(*), product_variants(*)'],
  ['categories', 'categories', 'id,name,slug,is_active']
]
const CATEGORY_TABLES = [['categories', 'categories', '*']]
const INVENTORY_TABLES = [
  ['products', 'products', 'id,name,stock_quantity,status'],
  ['variants', 'product_variants', 'id,product_id,size,color,stock_quantity,low_stock_threshold,is_active,products(name)'],
  ['costs', 'product_variant_costs', 'variant_id,unit_cost'],
  ['movements', 'inventory_movements', 'id,product_id,variant_id,movement_type,quantity_delta,stock_after,reason,created_at,products(name),product_variants(size,color)']
]
const ORDER_TABLES = [
  ['orders', 'orders', '*, profiles!orders_user_id_fkey(full_name,email,phone), order_items(*), order_events(id,event_type,from_status,to_status,note,created_at)']
]
const CUSTOMER_TABLES = [
  ['profiles', 'profiles', 'id,email,full_name,phone,created_at'],
  ['orders', 'orders', 'id,user_id,status,total,payment_status']
]

function ErrorMessage({ children }) {
  return children ? <p className="stage-two-error" role="alert">{children}</p> : null
}

function LocalImagePreview({ file, alt }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setSrc(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return <img src={src} alt={alt} />
}

function Notice({ children }) {
  return children ? <p className="stage-two-notice" role="status">{children}</p> : null
}

function useWorkspaceData(tables) {
  const [reload, setReload] = useState(0)
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState(supabase ? '' : 'Supabase is not configured.')

  const refresh = useCallback(() => {
    setError('')
    setLoading(Boolean(supabase))
    setReload((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!supabase) return undefined

    let active = true
    Promise.all(tables.map(async ([key, table, query]) => {
      let request = supabase.from(table).select(query || '*')
      if (key === 'products') request = request.order('created_at', { ascending: false })
      else if (key === 'categories') request = request.order('name')
      else if (key === 'variants') request = request.order('created_at', { ascending: true })
      else if (key === 'orders') request = request.order('created_at', { ascending: false })
      else if (key === 'profiles') request = request.order('created_at', { ascending: false })
      else if (key === 'movements') request = request.order('created_at', { ascending: false })
      const { data: rows, error: queryError } = await request
      if (queryError) throw queryError
      return [key, rows || []]
    })).then((entries) => {
      if (active) setData(Object.fromEntries(entries))
    }).catch((queryError) => {
      if (active) setError(queryError.message || 'Workspace data could not be loaded.')
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [tables, reload])

  return { data, loading, error, refresh }
}

function SearchControls({ search, onSearch, status, onStatus, sort, onSort, categories, category, onCategory }) {
  return (
    <div className="stage-two-toolbar">
      <label className="stage-two-search">Search<input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search name, SKU, email…" /></label>
      {onStatus && <label>Status<select value={status} onChange={(event) => onStatus(event.target.value)}>
        <option value="">All statuses</option>
        {['draft', 'active', 'archived', 'pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'].map((value) => <option key={value} value={value}>{value}</option>)}
      </select></label>}
      {onCategory && <label>Category<select value={category} onChange={(event) => onCategory(event.target.value)}>
        <option value="">All categories</option>
        {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>}
      {onSort && <label>Sort<select value={sort} onChange={(event) => onSort(event.target.value)}>
        <option value="newest">Newest</option><option value="name">Name</option><option value="price">Price</option><option value="stock">Stock</option>
      </select></label>}
    </div>
  )
}

function ProductForm({ product, categories, onClose, onSaved }) {
  const [productId] = useState(() => product?.id || crypto.randomUUID())
  const activeVariants = (product?.product_variants || []).filter((variant) => variant.is_active)
  const [form, setForm] = useState(() => product ? ({
    ...blankProduct,
    ...product,
    price: String(product.price),
    sale_price: product.sale_price == null ? '' : String(product.sale_price),
    sizes: [...new Set(activeVariants.map((variant) => variant.size).filter(Boolean))].length
      ? [...new Set(activeVariants.map((variant) => variant.size).filter(Boolean))]
      : blankProduct.sizes,
    colors: [...new Set(activeVariants.map((variant) => variant.color).filter(Boolean))].length
      ? [...new Set(activeVariants.map((variant) => variant.color).filter(Boolean))]
      : blankProduct.colors
  }) : blankProduct)
  const [images, setImages] = useState([])
  const [existingImages, setExistingImages] = useState(() => [...(product?.product_images || [])]
    .sort((left, right) => left.sort_order - right.sort_order))
  const [variantCosts, setVariantCosts] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [imageError, setImageError] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [validatingImages, setValidatingImages] = useState(false)

  useEffect(() => {
    const variantIds = (product?.product_variants || []).map((variant) => variant.id)
    if (!variantIds.length || !supabase) return undefined
    let active = true
    supabase.from('product_variant_costs').select('variant_id,unit_cost').in('variant_id', variantIds)
      .then(({ data, error: costError }) => {
        if (costError) throw costError
        if (active) setVariantCosts(Object.fromEntries((data || []).map((row) => [row.variant_id, String(row.unit_cost)])))
      })
      .catch((costError) => {
        if (active) setError(costError.message || 'Product costs could not be loaded.')
      })
    return () => { active = false }
  }, [product])

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: '' }))
  }
  const updateList = (key, value) => {
    setField(key, value.split(',').map((entry) => entry.trim()).filter(Boolean))
    setFieldErrors((current) => ({ ...current, variants: '' }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const price = Number(form.price)
    const salePrice = form.sale_price === '' ? null : Number(form.sale_price)
    const nextFieldErrors = {}
    if (!form.name.trim()) nextFieldErrors.name = 'Enter a product name.'
    if (!Number.isFinite(price) || price <= 0) nextFieldErrors.price = 'Enter a valid regular price greater than zero.'
    if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice <= 0)) {
      nextFieldErrors.sale_price = 'Sale price must be a valid amount greater than zero.'
    }
    if (!form.sizes.length || !form.colors.length) nextFieldErrors.variants = 'Add at least one size and one color.'
    setFieldErrors(nextFieldErrors)
    if (Object.values(nextFieldErrors).some(Boolean)) return

    setBusy(true)
    setError('')
    setUploadStatus('')
    const uploadedPaths = []
    try {
      if (!supabase) throw new Error('Supabase is not configured.')
      for (const [index, image] of images.entries()) {
        const file = image.file
        const format = image.format || await validateProductImage(file)
        const safeName = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'image'
        const path = `${productId}/${crypto.randomUUID()}-${safeName}`
        setUploadStatus(`Uploading image ${index + 1} of ${images.length}: ${file.name}`)
        const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, {
          contentType: format.mimeType,
          upsert: false
        })
        if (uploadError) throw new Error(`Image upload failed for ${file.name}: ${uploadError.message}`)
        uploadedPaths.push(path)
      }

      const variants = form.sizes.flatMap((size) => form.colors.map((color) => {
        const existing = (product?.product_variants || []).find((variant) => variant.size === size && variant.color === color)
        return {
          size, color, sku: existing?.sku || null, price_override: existing?.price_override ?? null
        }
      }))
      const imagePaths = [...existingImages.map((image) => image.storage_path), ...uploadedPaths]
      const imageAltTexts = [
        ...existingImages.map((image) => image.alt_text || form.name),
        ...images.map((image) => image.alt_text || form.name)
      ]
      const variantCostData = variants.flatMap((variant) => {
        const existing = (product?.product_variants || []).find((item) => item.size === variant.size && item.color === variant.color)
        const amount = existing ? variantCosts[existing.id] : undefined
        return amount === undefined || amount === '' ? [] : [{
          size: variant.size,
          color: variant.color,
          unit_cost: Number(amount)
        }]
      })
      const slug = `${form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${productId}`
      setUploadStatus('Saving product details and image references…')
      const { error: saveError } = await supabase.rpc('admin_save_product_details', {
        p_product: {
          id: productId,
          name: form.name,
          slug,
          description: form.description,
          sku: form.sku || null,
          category_id: form.category_id || null,
          price,
          sale_price: salePrice,
          age_range: form.age_range,
          status: form.status,
          is_featured: Boolean(form.is_featured),
          metadata: {}
        },
        p_variants: variants,
        p_image_paths: imagePaths,
        p_image_alt_texts: imageAltTexts,
        p_featured: Boolean(form.is_featured),
        p_variant_costs: variantCostData
      })
      if (saveError) throw new Error(`Product database save failed: ${saveError.message}`)
      onSaved()
    } catch (submitError) {
      if (uploadedPaths.length && supabase) {
        const { error: cleanupError } = await supabase.storage.from('product-images').remove(uploadedPaths)
        if (cleanupError) {
          setError(`${submitError.message || 'Product could not be saved.'} Uploaded files also need cleanup: ${cleanupError.message}`)
          setBusy(false)
          return
        }
      }
      setError(submitError.message || 'Product could not be saved.')
    } finally {
      setBusy(false)
      setUploadStatus('')
    }
  }

  return (
    <div className="stage-two-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="stage-two-modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
        <header><h2 id="product-form-title">{product ? 'Edit product' : 'Add product'}</h2><button type="button" onClick={onClose} aria-label="Close">×</button></header>
        <ErrorMessage>{error}</ErrorMessage>
        <form className="stage-two-form" onSubmit={handleSubmit}>
          <label>Product name<input required maxLength="160" value={form.name} aria-invalid={Boolean(fieldErrors.name)} onChange={(event) => setField('name', event.target.value)} />{fieldErrors.name && <span className="stage-two-error">{fieldErrors.name}</span>}</label>
          <label>Description<textarea rows="4" value={form.description || ''} onChange={(event) => setField('description', event.target.value)} /></label>
          <div className="stage-two-form-grid">
            <label>SKU<input value={form.sku || ''} onChange={(event) => setField('sku', event.target.value)} /></label>
            <label>Category<select value={form.category_id || ''} onChange={(event) => setField('category_id', event.target.value)}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label>Price (PKR)<input type="number" min="0.01" step="0.01" required value={form.price} aria-invalid={Boolean(fieldErrors.price)} onChange={(event) => setField('price', event.target.value)} />{fieldErrors.price && <span className="stage-two-error">{fieldErrors.price}</span>}</label>
            <label>Sale price (PKR)<input type="number" min="0.01" step="0.01" value={form.sale_price || ''} aria-invalid={Boolean(fieldErrors.sale_price)} onChange={(event) => setField('sale_price', event.target.value)} />{fieldErrors.sale_price && <span className="stage-two-error">{fieldErrors.sale_price}</span>}</label>
            <label>Age range<input placeholder="Ages 2Y–10Y" value={form.age_range || ''} onChange={(event) => setField('age_range', event.target.value)} /></label>
            <label>Status<select value={form.status} onChange={(event) => setField('status', event.target.value)}><option value="draft">Draft</option><option value="active">Published</option><option value="archived">Archived</option></select></label>
          </div>
          <label className="stage-two-checkbox"><input type="checkbox" checked={Boolean(form.is_featured)} onChange={(event) => setField('is_featured', event.target.checked)} />Featured product</label>
          <label>Sizes <span>Comma-separated</span><input required value={form.sizes.join(', ')} onChange={(event) => updateList('sizes', event.target.value)} placeholder={SIZES.join(', ')} /></label>
          <label>Colors <span>Comma-separated</span><input required value={form.colors.join(', ')} onChange={(event) => updateList('colors', event.target.value)} placeholder="Navy, Ivory" /></label>
          {fieldErrors.variants && <p className="stage-two-error" role="alert">{fieldErrors.variants}</p>}
          <fieldset className="product-gallery-editor"><legend>Product image gallery</legend>
            <label>Add images<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple disabled={busy || validatingImages} onChange={async (event) => {
                const input = event.currentTarget
                const selected = Array.from(input.files || [])
                input.value = ''
                setImageError('')
                setValidatingImages(true)
                const accepted = []
                const rejected = []
                for (const file of selected) {
                  try {
                    const format = await validateProductImage(file)
                    accepted.push({ file, format, alt_text: form.name })
                  } catch (validationError) {
                    rejected.push(validationError.message)
                  }
                }
                if (accepted.length) setImages((current) => [...current, ...accepted])
                if (rejected.length) setImageError(rejected.join(' '))
                setValidatingImages(false)
              }} /></label>
              <span>PNG, JPEG, WebP, GIF or AVIF; maximum 10 MB per image.</span>
              {imageError && <p className="stage-two-error" role="alert">{imageError}</p>}
              {validatingImages && <p role="status">Checking selected image files…</p>}
            {existingImages.map((image, index) => <div className="product-gallery-editor-row" key={image.id || image.storage_path}>
              <img src={supabase?.storage.from('product-images').getPublicUrl(image.storage_path).data.publicUrl} alt={image.alt_text || form.name} />
              <label>Alt text<input value={image.alt_text || ''} onChange={(event) => setExistingImages((current) => current.map((entry, position) => position === index ? { ...entry, alt_text: event.target.value } : entry))} /></label>
              <button type="button" disabled={index === 0} onClick={() => setExistingImages((current) => {
                const next = [...current]
                ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                return next
              })}>Move up</button>
              <button type="button" disabled={index === existingImages.length - 1} onClick={() => setExistingImages((current) => {
                const next = [...current]
                ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
                return next
              })}>Move down</button>
              <button type="button" onClick={() => setExistingImages((current) => current.filter((_, position) => position !== index))}>Remove</button>
            </div>)}
            {images.map((image, index) => <div className="product-gallery-editor-row" key={`${image.file.name}-${index}`}>
              <LocalImagePreview file={image.file} alt={image.alt_text || form.name} />
              <label>{image.file.name} · {(image.file.size / 1024).toFixed(0)} KB alt text<input value={image.alt_text} onChange={(event) => setImages((current) => current.map((entry, position) => position === index ? { ...entry, alt_text: event.target.value } : entry))} /></label>
              <button type="button" onClick={() => setImages((current) => current.filter((_, position) => position !== index))}>Remove</button>
            </div>)}
          </fieldset>
          {form.sizes.flatMap((size) => form.colors.map((color) => {
            const variant = (product?.product_variants || []).find((item) => item.size === size && item.color === color)
            return <label key={`${size}-${color}`}>Purchase / manufacturing cost — {size} / {color} (PKR)
              <input type="number" min="0" step="0.01" value={variant ? variantCosts[variant.id] ?? '' : ''}
                onChange={(event) => variant && setVariantCosts((current) => ({ ...current, [variant.id]: event.target.value }))} disabled={!variant} />
              {!variant && <span>Save the product first to set cost for this new variant.</span>}
            </label>
          }))}
          {uploadStatus && <p role="status" aria-live="polite">{uploadStatus}</p>}
          <div className="stage-two-actions"><button type="button" className="stage-two-button" onClick={onClose} disabled={busy}>Cancel</button><button className="stage-two-button stage-two-button-primary" type="submit" disabled={busy || validatingImages}>{busy ? uploadStatus || 'Saving…' : 'Save product'}</button></div>
        </form>
      </section>
    </div>
  )
}

function ProductWorkspace() {
  const { data, loading, error, refresh } = useWorkspaceData(PRODUCT_TABLES)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState('')

  const products = useMemo(() => {
    let rows = (data.products || []).filter((product) => {
      const query = search.toLowerCase()
      return (!query || `${product.name} ${product.sku || ''}`.toLowerCase().includes(query))
        && (!status || product.status === status)
        && (!category || product.category_id === category)
    })
    rows = [...rows].sort((left, right) => {
      if (sort === 'name') return left.name.localeCompare(right.name)
      if (sort === 'price') return Number(left.price) - Number(right.price)
      if (sort === 'stock') return left.stock_quantity - right.stock_quantity
      return new Date(right.created_at) - new Date(left.created_at)
    })
    return rows
  }, [data.products, search, status, category, sort])
  const pageCount = Math.max(1, Math.ceil(products.length / PAGE_SIZE))

  const setProductStatus = async (product, nextStatus) => {
    setNotice('')
    try {
      const { error: updateError } = await supabase.rpc('admin_set_product_status', {
        p_product_id: product.id, p_status: nextStatus
      })
      if (updateError) throw updateError
      setNotice(`${product.name} is now ${nextStatus}.`)
      refresh()
    } catch (updateError) {
      setNotice(updateError.message || 'Product status could not be changed.')
    }
  }

  return (
    <section className="stage-two-workspace">
      <div className="admin-page-heading"><div><p className="admin-eyebrow">CATALOG MANAGEMENT</p><h1>Products</h1></div><div className="stage-three-actions"><button className="stage-two-button" onClick={() => exportCsv('little-star-products.csv', (data.products || []).map((product) => ({ name: product.name, sku: product.sku, category: product.categories?.name || '', price_pkr: product.price, sale_price_pkr: product.sale_price ?? '', stock_units: product.stock_quantity, status: product.status })))}>Export CSV</button><button className="stage-two-button stage-two-button-primary" onClick={() => setEditing({})}>＋ Add product</button></div></div>
      <SearchControls search={search} onSearch={(value) => { setSearch(value); setPage(0) }} status={status} onStatus={(value) => { setStatus(value); setPage(0) }} categories={data.categories || []} category={category} onCategory={(value) => { setCategory(value); setPage(0) }} sort={sort} onSort={setSort} />
      <Notice>{notice}</Notice><ErrorMessage>{error}</ErrorMessage>
      {loading ? <p className="stage-two-loading">Loading products…</p> : (
        <>
          <div className="stage-two-table-wrap"><table className="stage-two-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{products.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((product) => (
              <tr key={product.id}><td><strong>{product.name}</strong><small>{product.sku || 'No SKU'}</small></td><td>{product.categories?.name || '—'}</td><td>{product.sale_price ? <><strong>{PRICE_FORMAT.format(product.sale_price)}</strong><small><s>{PRICE_FORMAT.format(product.price)}</s></small></> : PRICE_FORMAT.format(product.price)}</td><td>{product.stock_quantity}</td><td><span className={`stage-two-badge stage-two-${product.status}`}>{product.status}</span></td>
                <td className="stage-two-row-actions"><button onClick={() => setEditing(product)}>Edit</button>{product.status === 'active' ? <button onClick={() => setProductStatus(product, 'draft')}>Unpublish</button> : product.status !== 'archived' ? <button onClick={() => setProductStatus(product, 'active')}>Publish</button> : null}{product.status !== 'archived' && <button onClick={() => setProductStatus(product, 'archived')}>Archive</button>}</td></tr>
            ))}</tbody></table>{products.length === 0 && <p className="stage-two-empty">No products match your filters.</p>}</div>
          <div className="stage-two-pagination"><span>{products.length} product(s)</span><div><button disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page + 1} of {pageCount}</span><button disabled={page + 1 >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>
        </>
      )}
      {editing && <ProductForm key={editing.id || 'new-product'} product={editing.id ? editing : null} categories={data.categories || []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); setNotice('Product saved successfully.') }} />}
    </section>
  )
}

function CategoryWorkspace() {
  const { data, loading, error, refresh } = useWorkspaceData(CATEGORY_TABLES)
  const [form, setForm] = useState(null)
  const [notice, setNotice] = useState('')

  const saveCategory = async (event) => {
    event.preventDefault()
    setNotice('')
    try {
      const { error: saveError } = await supabase.rpc('admin_save_category', { p_category: form })
      if (saveError) throw saveError
      setForm(null)
      setNotice('Category saved.')
      refresh()
    } catch (saveError) {
      setNotice(saveError.message || 'Category could not be saved.')
    }
  }

  return (
    <section className="stage-two-workspace">
      <div className="admin-page-heading"><div><p className="admin-eyebrow">CATALOG ORGANIZATION</p><h1>Categories</h1></div><button className="stage-two-button stage-two-button-primary" onClick={() => setForm({ name: '', slug: '', description: '', is_active: true })}>＋ Add category</button></div>
      <ErrorMessage>{error}</ErrorMessage><Notice>{notice}</Notice>
      {loading ? <p className="stage-two-loading">Loading categories…</p> : <div className="stage-two-table-wrap"><table className="stage-two-table"><thead><tr><th>Name</th><th>Slug</th><th>Description</th><th>Visibility</th><th /></tr></thead><tbody>{(data.categories || []).map((category) => <tr key={category.id}><td><strong>{category.name}</strong></td><td>{category.slug}</td><td>{category.description || '—'}</td><td>{category.is_active ? 'Active' : 'Hidden'}</td><td><button onClick={() => setForm({ ...category })}>Edit</button></td></tr>)}</tbody></table></div>}
      {form && <div className="stage-two-modal-backdrop"><section className="stage-two-modal" role="dialog" aria-modal="true"><header><h2>{form.id ? 'Edit category' : 'Add category'}</h2><button onClick={() => setForm(null)}>×</button></header><form className="stage-two-form" onSubmit={saveCategory}><label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, slug: form.id ? form.slug : event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} /></label><label>Slug<input required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label><label>Description<textarea value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="stage-two-checkbox"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />Visible in storefront</label><div className="stage-two-actions"><button type="button" onClick={() => setForm(null)}>Cancel</button><button className="stage-two-button-primary">Save category</button></div></form></section></div>}
    </section>
  )
}

function InventoryWorkspace() {
  const { data, loading, error, refresh } = useWorkspaceData(INVENTORY_TABLES)
  const [adjusting, setAdjusting] = useState(null)
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [kind, setKind] = useState('addition')
  const [notice, setNotice] = useState('')

  const submitAdjustment = async (event) => {
    event.preventDefault()
    setNotice('')
    try {
      const quantity = Math.abs(Number(delta))
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Enter a whole-number quantity greater than zero.')
      const signedQuantity = ['deduction', 'damaged'].includes(kind) ? -quantity : quantity
      const { error: adjustError } = await supabase.rpc('admin_adjust_inventory', {
        p_variant_id: adjusting.id,
        p_quantity_delta: signedQuantity,
        p_movement_type: kind,
        p_reason: reason
      })
      if (adjustError) throw adjustError
      setAdjusting(null)
      setDelta('')
      setReason('')
      setNotice('Inventory adjustment recorded.')
      refresh()
    } catch (adjustError) {
      setNotice(adjustError.message || 'Inventory could not be adjusted.')
    }
  }

  const alerts = (data.variants || []).filter((variant) => variant.is_active && variant.stock_quantity <= variant.low_stock_threshold)
  const unitCosts = new Map((data.costs || []).map((cost) => [cost.variant_id, Number(cost.unit_cost)]))
  return (
    <section className="stage-two-workspace">
      <div className="admin-page-heading"><div><p className="admin-eyebrow">STOCK CONTROL</p><h1>Inventory</h1></div><button className="stage-two-button" onClick={() => exportCsv('little-star-inventory.csv', (data.variants || []).map((variant) => { const unitCost = unitCosts.get(variant.id); return { product: variant.products?.name || '', size: variant.size, color: variant.color, stock_units: variant.stock_quantity, low_stock_threshold: variant.low_stock_threshold, unit_cost_pkr: unitCost ?? '', stock_valuation_pkr: unitCost == null ? 'Unknown cost' : unitCost * variant.stock_quantity } }))}>Export CSV</button></div>
      <ErrorMessage>{error}</ErrorMessage><Notice>{notice}</Notice>
      <h2 className="stage-two-section-title">Low stock &amp; out-of-stock alerts ({alerts.length})</h2>
      {alerts.length > 0 && <div className="stage-two-alert-list">{alerts.map((variant) => <span key={variant.id} className={variant.stock_quantity === 0 ? 'is-out-of-stock' : ''}>{variant.products?.name} · {variant.size}/{variant.color} · {variant.stock_quantity} left</span>)}</div>}
      <h2 className="stage-two-section-title">Variant stock</h2>
      {loading ? <p className="stage-two-loading">Loading inventory…</p> : <div className="stage-two-table-wrap"><table className="stage-two-table"><thead><tr><th>Product</th><th>Size</th><th>Color</th><th>On hand</th><th>Alert below</th><th /></tr></thead><tbody>{(data.variants || []).map((variant) => <tr key={variant.id}><td>{variant.products?.name || '—'}</td><td>{variant.size}</td><td>{variant.color}</td><td><strong>{variant.stock_quantity}</strong></td><td>{variant.low_stock_threshold}</td><td><button disabled={!variant.is_active} onClick={() => { setAdjusting(variant); setKind('addition') }}>Adjust stock</button></td></tr>)}</tbody></table></div>}
      <h2 className="stage-two-section-title">Movement history</h2>
      <div className="stage-two-table-wrap"><table className="stage-two-table"><thead><tr><th>Date</th><th>Product / variant</th><th>Type</th><th>Change</th><th>After</th><th>Reason</th></tr></thead><tbody>{(data.movements || []).slice(0, 50).map((movement) => <tr key={movement.id}><td>{new Date(movement.created_at).toLocaleString()}</td><td>{movement.products?.name} · {movement.product_variants?.size}/{movement.product_variants?.color}</td><td>{movement.movement_type}</td><td>{movement.quantity_delta > 0 ? '+' : ''}{movement.quantity_delta}</td><td>{movement.stock_after}</td><td>{movement.reason}</td></tr>)}</tbody></table></div>
      {adjusting && <div className="stage-two-modal-backdrop"><section className="stage-two-modal" role="dialog" aria-modal="true"><header><h2>Adjust inventory</h2><button onClick={() => setAdjusting(null)}>×</button></header><p>{adjusting.products?.name} · {adjusting.size}/{adjusting.color} · Current: {adjusting.stock_quantity}</p><form className="stage-two-form" onSubmit={submitAdjustment}><label>Movement type<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="addition">Stock addition</option><option value="deduction">Deduction</option><option value="damaged">Damaged</option><option value="return">Return to stock</option><option value="opening">Opening stock</option></select></label><label>Quantity<input type="number" min="1" step="1" required value={delta} onChange={(event) => setDelta(event.target.value)} /></label><label>Reason<input required value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="stage-two-actions"><button type="button" onClick={() => setAdjusting(null)}>Cancel</button><button className="stage-two-button-primary">Record adjustment</button></div></form></section></div>}
    </section>
  )
}

function OrderWorkspace({ actorName }) {
  const { data, loading, error, refresh } = useWorkspaceData(ORDER_TABLES)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selected, setSelected] = useState(null)
  const [notice, setNotice] = useState('')
  const rows = (data.orders || []).filter((order) => {
    const orderDate = order.created_at.slice(0, 10)
    const query = `${order.order_number} ${order.profiles?.full_name || ''} ${order.profiles?.email || ''} ${order.profiles?.phone || ''}`.toLowerCase()
    return (!status || order.status === status)
      && (!paymentMethod || order.payment_method === paymentMethod)
      && (!paymentStatus || order.payment_status === paymentStatus)
      && (!fromDate || orderDate >= fromDate)
      && (!toDate || orderDate <= toDate)
      && (!search || query.includes(search.toLowerCase()))
  })

  const updateOrder = async (order, nextStatus, paymentStatus = null) => {
    try {
      const { error: updateError } = await supabase.rpc('admin_update_order', {
        p_order_id: order.id, p_status: nextStatus, p_payment_status: paymentStatus,
        p_courier: order.courier, p_tracking_number: order.tracking_number,
        p_note: `Updated by ${actorName || 'admin'}`
      })
      if (updateError) throw updateError
      setNotice(`Order #${order.order_number} updated.`)
      setSelected(null)
      refresh()
    } catch (updateError) {
      setNotice(updateError.message || 'Order could not be updated.')
    }
  }

  const nextStatus = { pending: 'confirmed', confirmed: 'processing', processing: 'packed', packed: 'shipped', shipped: 'delivered', delivered: 'returned', returned: 'refunded' }
  return (
    <section className="stage-two-workspace">
      <div className="admin-page-heading"><div><p className="admin-eyebrow">FULFILLMENT</p><h1>Orders</h1></div><button className="stage-two-button" onClick={() => exportCsv('little-star-orders.csv', rows.map((order) => ({ order_number: order.order_number, created_at: order.created_at, customer: order.profiles?.full_name || '', email: order.profiles?.email || '', status: order.status, payment_status: order.payment_status, subtotal_pkr: order.subtotal, discounts_pkr: order.discount_total, shipping_pkr: order.shipping_total, total_pkr: order.total, coupon_code: order.coupon_code || '' })))}>Export CSV</button></div>
      <SearchControls search={search} onSearch={setSearch} status={status} onStatus={setStatus} />
      <div className="stage-two-toolbar">
        <label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="">All methods</option><option value="cod">Cash on Delivery</option><option value="easypaisa">Easypaisa</option></select></label>
        <label>Payment status<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="">All payment statuses</option>{['pending', 'unpaid', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
        <label>From date<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>To date<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
      </div>
      <Notice>{notice}</Notice><ErrorMessage>{error}</ErrorMessage>
      {loading ? <p className="stage-two-loading">Loading orders…</p> : <div className="stage-two-table-wrap"><table className="stage-two-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Payment</th><th>Fulfillment</th><th /></tr></thead><tbody>{rows.map((order) => <tr key={order.id}><td><strong>#{order.order_number}</strong></td><td>{order.profiles?.full_name || '—'}<small>{order.profiles?.email}<br />{order.profiles?.phone}</small></td><td>{new Date(order.created_at).toLocaleDateString()}</td><td>{PRICE_FORMAT.format(order.total)}</td><td>{order.payment_method.toUpperCase()} · {order.payment_status}</td><td><span className={`stage-two-badge stage-two-${order.status}`}>{order.status === 'pending' ? 'awaiting confirmation' : order.status}</span></td><td><button onClick={() => setSelected(order)}>View</button></td></tr>)}</tbody></table>{rows.length === 0 && <p className="stage-two-empty">No orders match your filters.</p>}</div>}
      {selected && <div className="stage-two-modal-backdrop"><section className="stage-two-modal" role="dialog" aria-modal="true"><header><h2>Order #{selected.order_number}</h2><button onClick={() => setSelected(null)}>×</button></header><div className="stage-two-customer"><strong>{selected.profiles?.full_name || 'Customer'}</strong><span>{selected.profiles?.email}</span><span>{selected.profiles?.phone}</span><p>{selected.shipping_address?.full_name}<br />{selected.shipping_address?.email}<br />{selected.shipping_address?.phone}{selected.shipping_address?.alternate_phone && <><br />{selected.shipping_address.alternate_phone}</>}<br />{selected.shipping_address?.house_landmark && <>{selected.shipping_address.house_landmark}, </>}{selected.shipping_address?.address_line1}<br />{selected.shipping_address?.area}, {selected.shipping_address?.city}, {selected.shipping_address?.province}{selected.shipping_address?.delivery_instructions && <><br />Instructions: {selected.shipping_address.delivery_instructions}</>}</p></div><div className="stage-two-table-wrap"><table className="stage-two-table"><thead><tr><th>Product</th><th>Size / color</th><th>Qty</th><th>Each</th><th>Total</th></tr></thead><tbody>{(selected.order_items || []).map((item) => <tr key={item.id}><td>{item.product_name}</td><td>{item.selected_size}/{item.selected_color}</td><td>{item.quantity}</td><td>{PRICE_FORMAT.format(item.unit_price)}</td><td>{PRICE_FORMAT.format(item.line_total)}</td></tr>)}</tbody></table></div><div className="stage-two-order-totals"><p>Subtotal <strong>{PRICE_FORMAT.format(selected.subtotal)}</strong></p><p>Discount <strong>{PRICE_FORMAT.format(selected.discount_total)}</strong></p><p>Delivery <strong>{PRICE_FORMAT.format(selected.shipping_total)}</strong></p><p>Total <strong>{PRICE_FORMAT.format(selected.total)}</strong></p></div><section className="stage-two-order-history"><h3>Status history</h3>{(selected.order_events || []).map((event) => <p key={event.id}><strong>{event.to_status || event.event_type}</strong><span>{new Date(event.created_at).toLocaleString()}</span>{event.note && <small>{event.note}</small>}</p>)}</section><div className="stage-two-form-grid"><label>Courier<input value={selected.courier || ''} onChange={(event) => setSelected({ ...selected, courier: event.target.value })} /></label><label>Tracking number<input value={selected.tracking_number || ''} onChange={(event) => setSelected({ ...selected, tracking_number: event.target.value })} /></label></div><div className="stage-two-actions stage-two-wrap-actions"><button onClick={() => window.print()}>Print invoice / packing slip</button>{selected.status === 'delivered' && ['pending', 'unpaid'].includes(selected.payment_status) && <button onClick={() => updateOrder(selected, null, 'paid')}>Mark COD paid</button>}{['pending', 'confirmed', 'processing', 'packed'].includes(selected.status) && <button className="stage-two-button-primary" onClick={() => updateOrder(selected, nextStatus[selected.status])}>Mark {nextStatus[selected.status]}</button>}{['pending', 'confirmed', 'processing', 'packed'].includes(selected.status) && <button onClick={() => updateOrder(selected, 'cancelled')}>Cancel and restore stock</button>}{selected.status === 'shipped' && <button onClick={() => updateOrder(selected, 'delivered')}>Mark delivered</button>}{selected.status === 'delivered' && <button onClick={() => updateOrder(selected, 'returned')}>Record return</button>}{selected.status === 'returned' && selected.payment_status === 'paid' && <button onClick={() => updateOrder(selected, 'refunded')}>Record refund</button>}</div></section></div>}
    </section>
  )
}

function CustomerWorkspace() {
  const { data, loading, error } = useWorkspaceData(CUSTOMER_TABLES)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const ordersByUser = useMemo(() => {
    const result = new Map()
    for (const order of data.orders || []) {
      const current = result.get(order.user_id) || { count: 0, spending: 0 }
      current.count += 1
      if (['paid', 'delivered'].includes(order.payment_status) || order.status === 'delivered') current.spending += Number(order.total)
      result.set(order.user_id, current)
    }
    return result
  }, [data.orders])
  const rows = (data.profiles || []).map((profile) => ({ ...profile, ...(ordersByUser.get(profile.id) || { count: 0, spending: 0 }) }))
    .filter((profile) => (!status || (status === 'with-orders' ? profile.count > 0 : profile.count === 0))
      && (!search || `${profile.full_name} ${profile.email} ${profile.phone || ''}`.toLowerCase().includes(search.toLowerCase())))

  return (
    <section className="stage-two-workspace">
      <div className="admin-page-heading"><div><p className="admin-eyebrow">CUSTOMER RELATIONSHIPS</p><h1>Customers</h1></div></div>
      <div className="stage-two-toolbar"><label className="stage-two-search">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, phone…" /></label><label>Orders<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All customers</option><option value="with-orders">With orders</option><option value="no-orders">No orders</option></select></label></div>
      <ErrorMessage>{error}</ErrorMessage>
      {loading ? <p className="stage-two-loading">Loading customers…</p> : <div className="stage-two-table-wrap"><table className="stage-two-table"><thead><tr><th>Customer</th><th>Contact</th><th>Registered</th><th>Orders</th><th>Eligible spend</th></tr></thead><tbody>{rows.map((customer) => <tr key={customer.id}><td><strong>{customer.full_name || 'Customer'}</strong><small>{customer.role === 'admin' ? 'Administrator' : 'Customer'}</small></td><td>{customer.email}<small>{customer.phone || 'No phone number'}</small></td><td>{new Date(customer.created_at).toLocaleDateString()}</td><td>{customer.count}</td><td>{PRICE_FORMAT.format(customer.spending)}</td></tr>)}</tbody></table></div>}
      <p className="stage-two-muted">Order counts include actual records. Spend totals include delivered or paid orders.</p>
    </section>
  )
}

export default function StageTwoWorkspace({ section }) {
  const { profile } = useAuth()
  if (profile?.role !== 'admin') return <ErrorMessage>Administrator access is required.</ErrorMessage>
  if (section === 'products') return <ProductWorkspace />
  if (section === 'categories') return <CategoryWorkspace />
  if (section === 'inventory') return <InventoryWorkspace />
  if (section === 'orders') return <OrderWorkspace actorName={profile.full_name || profile.email} />
  if (section === 'customers') return <CustomerWorkspace />
  return null
}
