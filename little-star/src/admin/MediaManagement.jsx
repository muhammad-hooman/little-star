import { useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useManagedSite } from '../lib/ManagedSiteContext'
import StageTwoWorkspace from './StageTwoWorkspace'
import './media-management.css'

const MEDIA_TYPES = ['product', 'hero', 'banner', 'category', 'brand', 'size-chart', 'section', 'other']
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
const MAX_FILE_SIZE = 10 * 1024 * 1024
const CROPS = {
  original: null,
  '1:1': 1,
  '4:5': 4 / 5,
  '16:9': 16 / 9
}

function publicUrl(asset) {
  if (asset.storage_path && supabase) {
    return supabase.storage.from('product-images').getPublicUrl(asset.storage_path).data.publicUrl
  }
  return asset.external_url || ''
}

function safeFileName(fileName) {
  return fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'image'
}

function loadBitmap(file) {
  if (window.createImageBitmap) return window.createImageBitmap(file)
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Could not read ${file.name} as an image.`))
    }
    image.src = url
  })
}

async function prepareImage(file, cropKey) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error(`${file.name}: use JPEG, PNG, WebP, GIF, or AVIF images.`)
  if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name}: image must be 10 MB or smaller.`)
  if (file.type === 'image/gif' && cropKey !== 'original') {
    throw new Error('Animated GIFs cannot be cropped without flattening the animation. Choose original proportions.')
  }
  if (cropKey === 'original' && file.type === 'image/gif') {
    const bitmap = await loadBitmap(file)
    const dimensions = { file, width: bitmap.width, height: bitmap.height }
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()
    return dimensions
  }

  const bitmap = await loadBitmap(file)
  const targetRatio = CROPS[cropKey]
  const naturalRatio = bitmap.width / bitmap.height
  const sourceWidth = targetRatio && naturalRatio > targetRatio ? bitmap.height * targetRatio : bitmap.width
  const sourceHeight = targetRatio && naturalRatio < targetRatio ? bitmap.width / targetRatio : bitmap.height
  const sourceX = (bitmap.width - sourceWidth) / 2
  const sourceY = (bitmap.height - sourceHeight) / 2
  const scale = Math.min(1, 2400 / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not create an image preview.')
  context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height)
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()
  const outputType = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((output) => output ? resolve(output) : reject(new Error(`Could not process ${file.name}.`)), outputType, 0.92)
  })
  const extension = outputType === 'image/png' ? '.png' : outputType === 'image/webp' ? '.webp' : '.jpg'
  const baseName = safeFileName(file.name).replace(/\.[^.]+$/, '')
  return {
    file: new File([blob], `${baseName}${extension}`, { type: outputType }),
    width,
    height
  }
}

function assetUsedBy(asset, content) {
  const uses = []
  if (asset.product_id) uses.push(`Product: ${asset.asset_name.replace(/ image$/, '')}`)
  if (asset.asset_key.startsWith('product.sample.') || asset.asset_key.startsWith('product.sale.')) uses.push('Sample catalog product')
  const references = content.filter((row) => [row.published_payload, row.draft_payload]
    .some((payload) => payload?.image_key === asset.asset_key || payload?.mobile_image_key === asset.asset_key))
  uses.push(...references.map((row) => row.label))
  return [...new Set(uses)].join(', ')
}

function MediaCard({ asset, usage, onSaved, onReplace, onDelete, resolveImage }) {
  const [name, setName] = useState(asset.asset_name)
  const [type, setType] = useState(asset.asset_type)
  const [altText, setAltText] = useState(asset.alt_text || '')
  const [order, setOrder] = useState(String(asset.display_order ?? 0))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const fileRef = useRef(null)
  const src = resolveImage(asset.asset_key, publicUrl(asset))

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { error: saveError } = await supabase.rpc('admin_update_media', {
        p_asset_id: asset.id,
        p_asset_name: name.trim(),
        p_asset_type: type,
        p_alt_text: altText,
        p_display_order: Number(order)
      })
      if (saveError) throw saveError
      setNotice('Media details saved.')
      await onSaved()
    } catch (saveError) {
      setError(saveError.message || 'Media details could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const formatSize = (size) => size == null ? 'Unknown size' : `${(Number(size) / 1024).toFixed(0)} KB`
  const formatDimensions = () => asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'Unknown dimensions'
  return (
    <article className="media-card">
      <button className="media-preview-button" type="button" onClick={() => setPreviewOpen(true)}>
        <img src={src} alt={asset.alt_text || asset.asset_name} loading="lazy" />
        <span>Preview image</span>
      </button>
      <form className="media-card-form" onSubmit={save}>
        <label>Image name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Alt text<input value={altText} onChange={(event) => setAltText(event.target.value)} /></label>
        <div className="media-form-row">
          <label>Type<select value={type} onChange={(event) => setType(event.target.value)}>{MEDIA_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Order<input type="number" min="0" value={order} onChange={(event) => setOrder(event.target.value)} /></label>
        </div>
        <dl className="media-details">
          <div><dt>Used in</dt><dd>{usage || 'Not assigned'}</dd></div>
          <div><dt>Dimensions</dt><dd>{formatDimensions()}</dd></div>
          <div><dt>Size / format</dt><dd>{formatSize(asset.file_size)} · {asset.mime_type || 'External image'}</dd></div>
          <div><dt>Uploaded</dt><dd>{asset.created_at ? new Date(asset.created_at).toLocaleDateString() : 'Imported asset'}</dd></div>
          <div><dt>Status</dt><dd>{asset.is_published ? 'Published' : 'Draft'}</dd></div>
        </dl>
        {error && <p role="alert" className="media-error">{error}</p>}
        {notice && <p role="status" className="media-success">{notice}</p>}
        <div className="media-actions">
          <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save metadata'}</button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>Replace</button>
          <button type="button" onClick={async () => {
            try {
              await navigator.clipboard.writeText(src)
              setNotice('Image URL copied.')
              setError('')
            } catch (copyError) {
              setError(copyError.message || 'Could not copy the image URL.')
            }
          }}>Copy URL</button>
          <button className="media-danger-button" type="button" disabled={busy || Boolean(usage)} title={usage ? `Used in ${usage}` : 'Delete unused image'} onClick={() => onDelete(asset)}>Delete</button>
        </div>
        <input
          ref={fileRef}
          className="media-hidden-input"
          type="file"
          accept={IMAGE_TYPES.join(',')}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void onReplace(asset, file)
          }}
        />
      </form>
      {previewOpen && <div className="media-lightbox" role="dialog" aria-modal="true" aria-label={`Preview ${name}`} onClick={() => setPreviewOpen(false)}>
        <button type="button" aria-label="Close preview" onClick={() => setPreviewOpen(false)}>×</button>
        <img src={src} alt={altText || name} onClick={(event) => event.stopPropagation()} />
      </div>}
    </article>
  )
}

export function MediaWorkspace({ typeFilter = '' }) {
  const { assets, content, loading, error, refresh, resolveImage } = useManagedSite()
  const [search, setSearch] = useState('')
  const [type, setType] = useState(typeFilter)
  const [usageFilter, setUsageFilter] = useState('')
  const [sort, setSort] = useState('date')
  const [crop, setCrop] = useState('original')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploadType, setUploadType] = useState(typeFilter || 'other')
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploadResult, setUploadResult] = useState('')

  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return assets.map((asset) => ({ ...asset, usage: assetUsedBy(asset, content) }))
      .filter((asset) => !type || asset.asset_type === type)
      .filter((asset) => !usageFilter || (usageFilter === 'used' ? Boolean(asset.usage) : !asset.usage))
      .filter((asset) => !query || [asset.asset_name, asset.asset_key, asset.alt_text, asset.usage, asset.asset_type]
        .some((value) => value?.toLocaleLowerCase().includes(query)))
      .sort((left, right) => sort === 'name'
        ? left.asset_name.localeCompare(right.asset_name)
        : new Date(right.created_at || 0) - new Date(left.created_at || 0))
  }, [assets, content, search, type, usageFilter, sort])

  const validateFiles = (files) => {
    const invalid = files.find((file) => !IMAGE_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE)
    if (invalid) throw new Error(`${invalid.name}: choose a JPEG, PNG, WebP, GIF, or AVIF image under 10 MB.`)
  }

  const uploadFiles = async (event) => {
    event.preventDefault()
    setUploading(true)
    setNotice('')
    setUploadError('')
    setUploadResult('')
    const problems = []
    let uploaded = 0
    try {
      if (!supabase) throw new Error('Supabase is not configured.')
      validateFiles(selectedFiles)
      if (!selectedFiles.length) throw new Error('Choose at least one image to upload.')
      for (const sourceFile of selectedFiles) {
        let storagePath = ''
        try {
          const processed = await prepareImage(sourceFile, crop)
          const assetId = crypto.randomUUID()
          storagePath = `managed/${assetId}/${safeFileName(processed.file.name)}`
          const { error: storageError } = await supabase.storage.from('product-images').upload(storagePath, processed.file, {
            contentType: processed.file.type,
            upsert: false
          })
          if (storageError) throw storageError
          const { error: registerError } = await supabase.rpc('admin_register_media', {
            p_asset_key: `uploaded:${assetId}`,
            p_asset_name: sourceFile.name.replace(/\.[^.]+$/, ''),
            p_asset_type: uploadType,
            p_storage_path: storagePath,
            p_mime_type: processed.file.type,
            p_file_size: processed.file.size,
            p_width: processed.width,
            p_height: processed.height,
            p_alt_text: ''
          })
          if (registerError) throw registerError
          uploaded += 1
        } catch (fileError) {
          if (storagePath) {
            const { error: cleanupError } = await supabase.storage.from('product-images').remove([storagePath])
            if (cleanupError) problems.push(`${sourceFile.name}: cleanup failed (${cleanupError.message}).`)
          }
          problems.push(`${sourceFile.name}: ${fileError.message || 'upload failed.'}`)
        }
      }
      setSelectedFiles([])
      setUploadResult(`${uploaded} image${uploaded === 1 ? '' : 's'} uploaded.`)
      setNotice(uploaded ? 'Images are now available in the media library.' : '')
      await refresh()
      if (problems.length) setUploadError(problems.join(' '))
    } catch (uploadError) {
      setUploadError(uploadError.message || 'Images could not be uploaded.')
    } finally {
      setUploading(false)
    }
  }

  const replaceAsset = async (asset, sourceFile) => {
    if (!window.confirm(`Replace "${asset.asset_name}" with "${sourceFile.name}"? This updates every reference to the asset.`)) return
    setNotice('')
    setUploadError('')
    try {
      if (!supabase) throw new Error('Supabase is not configured.')
      const processed = await prepareImage(sourceFile, crop)
      const assetUploadId = crypto.randomUUID()
      const storagePath = `managed/${assetUploadId}/${safeFileName(processed.file.name)}`
      const { error: storageError } = await supabase.storage.from('product-images').upload(storagePath, processed.file, {
        contentType: processed.file.type, upsert: false
      })
      if (storageError) throw storageError
      const { data: oldPath, error: replaceError } = await supabase.rpc('admin_replace_media', {
        p_asset_id: asset.id,
        p_storage_path: storagePath,
        p_mime_type: processed.file.type,
        p_file_size: processed.file.size,
        p_width: processed.width,
        p_height: processed.height
      })
      if (replaceError) {
        const { error: cleanupError } = await supabase.storage.from('product-images').remove([storagePath])
        if (cleanupError) throw new Error(`${replaceError.message} The unused upload could not be cleaned up: ${cleanupError.message}`)
        throw replaceError
      }
      if (oldPath) {
        const { error: removeError } = await supabase.storage.from('product-images').remove([oldPath])
        if (removeError) setUploadError(`Image was replaced successfully, but the old file remains in storage: ${removeError.message}`)
      }
      setNotice(`${asset.asset_name} was replaced. Published pages now use the new image.`)
      await refresh()
    } catch (replaceError) {
      setUploadError(replaceError.message || 'Image replacement failed.')
    }
  }

  const deleteAsset = async (asset) => {
    const used = assetUsedBy(asset, content)
    if (used) {
      setUploadError(`This image is still used by ${used}. Replace it or remove its association before deleting it.`)
      return
    }
    if (!window.confirm(`Delete "${asset.asset_name}"? This cannot be undone.`)) return
    setNotice('')
    setUploadError('')
    try {
      const { data: path, error: deleteError } = await supabase.rpc('admin_delete_media', { p_asset_id: asset.id })
      if (deleteError) throw deleteError
      if (path) {
        const { error: storageError } = await supabase.storage.from('product-images').remove([path])
        if (storageError) setUploadError(`Media reference was deleted, but the unused storage file remains: ${storageError.message}`)
      }
      setNotice('Media asset deleted.')
      await refresh()
    } catch (deleteError) {
      setUploadError(deleteError.message || 'Media asset could not be deleted.')
    }
  }

  return <section className="media-workspace">
    <div className="admin-page-heading">
      <div><p className="admin-eyebrow">CENTRAL ASSET LIBRARY</p><h1>{typeFilter === 'product' ? 'Product Image Manager' : typeFilter === 'size-chart' ? 'Size Chart Manager' : 'Media Library'}</h1></div>
      <span className="admin-data-state">{assets.length} registered asset(s)</span>
    </div>
    {error && <p className="stage-two-error" role="alert">{error}{supabase ? ' Apply migration 20261022000000_media_and_website_content.sql, then reload.' : ''}</p>}
    {notice && <p className="stage-two-notice" role="status">{notice}</p>}
    {uploadResult && <p className="media-success" role="status">{uploadResult}</p>}
    {uploadError && <p className="stage-two-error" role="alert">{uploadError}</p>}

    {typeFilter === 'product' && <div className="media-product-manager"><p>Product records, variant stock, and purchase costs remain managed in the existing product and inventory workflows. The gallery editor is available from each product below.</p><StageTwoWorkspace section="products" /></div>}

    <form className="media-upload-panel" onSubmit={uploadFiles}>
      <div><h2>Upload images</h2><p>Choose original proportions or a center crop. Images are resized to a maximum 2400px edge for the web; your selected source file is never modified.</p></div>
      <label>Choose images<input type="file" multiple accept={IMAGE_TYPES.join(',')} onChange={(event) => {
        const files = [...(event.target.files || [])]
        try {
          validateFiles(files)
          setUploadError('')
          setSelectedFiles(files)
        } catch (selectionError) {
          setUploadError(selectionError.message)
          setSelectedFiles([])
        }
      }} /></label>
      <div className="media-form-row">
        <label>Image type<select value={uploadType} onChange={(event) => setUploadType(event.target.value)}>{MEDIA_TYPES.filter((value) => value !== 'product').map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Crop / aspect ratio<select value={crop} onChange={(event) => setCrop(event.target.value)}>{Object.keys(CROPS).map((value) => <option key={value} value={value}>{value === 'original' ? 'Original proportions' : `Center crop ${value}`}</option>)}</select></label>
      </div>
      {selectedFiles.length > 0 && <p>{selectedFiles.map((file) => `${file.name} (${(file.size / 1024).toFixed(0)} KB)`).join(' · ')}</p>}
      <button type="submit" className="stage-two-button stage-two-button-primary" disabled={uploading || !selectedFiles.length}>{uploading ? 'Uploading…' : 'Upload selected images'}</button>
    </form>

    <div className="media-filters">
      <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filename, product, category or alt text" /></label>
      <label>Type<select value={type} onChange={(event) => setType(event.target.value)}><option value="">All types</option>{MEDIA_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Usage<select value={usageFilter} onChange={(event) => setUsageFilter(event.target.value)}><option value="">All usage</option><option value="used">In use</option><option value="unused">Unused</option></select></label>
      <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="date">Upload date</option><option value="name">Filename</option></select></label>
    </div>
    {loading ? <p className="stage-two-loading">Loading media library…</p> : rows.length ? <div className="media-grid">
      {rows.map((asset) => <MediaCard
        key={asset.id}
        asset={asset}
        usage={asset.usage}
        onSaved={refresh}
        onReplace={replaceAsset}
        onDelete={deleteAsset}
        resolveImage={resolveImage}
      />)}
    </div> : <p className="stage-two-empty">No image assets match these filters.</p>}
  </section>
}

export function WebsiteContentWorkspace({ sectionFilter = '' }) {
  const { content, assets, loading, error, refresh, resolveImage } = useManagedSite()
  const [editing, setEditing] = useState(null)
  const [busyKey, setBusyKey] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState(null)

  const rows = content.filter((row) => !sectionFilter
    || (sectionFilter === 'homepage-manager' && ['hero', 'banner', 'section'].includes(row.content_type))
    || (sectionFilter === 'size-chart' && row.content_type === 'size-chart'))
    .sort((left, right) => left.display_order - right.display_order || left.label.localeCompare(right.label))

  const openEditor = (row) => {
    setFormError('')
    setNotice('')
    setEditing({
      ...row,
      payload: { ...row.draft_payload },
      enabled: row.draft_enabled,
      order: String(row.display_order)
    })
  }
  const updatePayload = (key, value) => setEditing((current) => ({
    ...current,
    payload: { ...current.payload, [key]: value }
  }))
  const saveDraft = async (publish = false) => {
    setBusyKey(editing.content_key)
    setFormError('')
    setNotice('')
    try {
      const { error: saveError } = await supabase.rpc('admin_save_website_content', {
        p_content_key: editing.content_key,
        p_payload: editing.payload,
        p_enabled: editing.enabled,
        p_display_order: Number(editing.order)
      })
      if (saveError) throw saveError
      if (publish) {
        const { error: publishError } = await supabase.rpc('admin_publish_website_content', {
          p_content_key: editing.content_key,
          p_publish: true
        })
        if (publishError) throw publishError
      }
      setEditing(null)
      setNotice(publish ? 'Changes published to the storefront.' : 'Draft saved. The live website is unchanged until you publish.')
      await refresh()
    } catch (saveError) {
      setFormError(saveError.message || 'Website content could not be saved.')
    } finally {
      setBusyKey('')
    }
  }
  const setPublished = async (row, publish) => {
    setBusyKey(row.content_key)
    setFormError('')
    setNotice('')
    try {
      const { error: publishError } = await supabase.rpc('admin_publish_website_content', {
        p_content_key: row.content_key,
        p_publish: publish
      })
      if (publishError) throw publishError
      setNotice(publish ? `${row.label} published.` : `${row.label} unpublished.`)
      await refresh()
    } catch (publishError) {
      setFormError(publishError.message || 'Publishing status could not be changed.')
    } finally {
      setBusyKey('')
    }
  }

  return <section className="media-workspace">
    <div className="admin-page-heading"><div><p className="admin-eyebrow">STOREFRONT CONTENT</p><h1>{sectionFilter === 'homepage-manager' ? 'Homepage Manager' : sectionFilter === 'size-chart' ? 'Size Chart Manager' : 'Website Content'}</h1></div></div>
    {(error || formError) && <p className="stage-two-error" role="alert">{formError || `${error}${supabase ? ' Apply migration 20261022000000_media_and_website_content.sql, then reload.' : ''}`}</p>}
    {notice && <p className="stage-two-notice" role="status">{notice}</p>}
    {loading ? <p className="stage-two-loading">Loading published content…</p> : <div className="content-manager-list">
      {rows.map((row) => {
        const payload = row.draft_payload
        const asset = assets.find((item) => item.asset_key === payload.image_key)
        return <article className="content-manager-card" key={row.content_key}>
          {asset && <img src={resolveImage(asset.asset_key)} alt={payload.alt_text || row.label} />}
          <div className="content-manager-copy">
            <div className="content-manager-title"><div><span>{row.content_type}</span><h2>{row.label}</h2><small>{row.content_key}</small></div><span className={`content-status ${row.is_published && row.published_enabled ? 'is-live' : ''}`}>{row.is_published && row.published_enabled ? 'Published' : 'Unpublished'}</span></div>
            <p>{payload.headline || payload.description || payload.alt_text || 'No editable text fields.'}</p>
            <p className="content-manager-draft-state">{JSON.stringify(row.draft_payload) === JSON.stringify(row.published_payload) && row.draft_enabled === row.published_enabled ? 'No unpublished edits' : 'Draft differs from live version'}</p>
            <div className="media-actions">
              <button type="button" onClick={() => setPreview(row)}>Preview draft</button>
              <button type="button" onClick={() => openEditor(row)}>Edit draft</button>
              {row.is_published ? <button type="button" disabled={busyKey === row.content_key} onClick={() => setPublished(row, false)}>Unpublish</button> : <button type="button" disabled={busyKey === row.content_key} onClick={() => setPublished(row, true)}>Publish draft</button>}
            </div>
          </div>
        </article>
      })}
      {!rows.length && <p className="stage-two-empty">No website content is registered yet. Apply the media and website content migration.</p>}
    </div>}
    {editing && <div className="stage-two-modal-backdrop"><section className="stage-two-modal media-content-modal" role="dialog" aria-modal="true" aria-labelledby="content-editor-title">
      <header><h2 id="content-editor-title">Edit {editing.label}</h2><button type="button" onClick={() => setEditing(null)} aria-label="Close editor">×</button></header>
      <p>Edits are saved as a draft and will not change the public storefront until published.</p>
      {Object.entries(editing.payload).map(([key, value]) => {
        if (key.endsWith('_key')) return <label key={key}>{key.replaceAll('_', ' ')}<select value={value || ''} onChange={(event) => updatePayload(key, event.target.value)}><option value="">No image</option>{assets.map((asset) => <option key={asset.asset_key} value={asset.asset_key}>{asset.asset_name} ({asset.asset_type})</option>)}</select></label>
        if (typeof value !== 'string') return null
        return <label key={key}>{key.replaceAll('_', ' ')}{value.length > 90 || key === 'description'
          ? <textarea rows={4} value={value} onChange={(event) => updatePayload(key, event.target.value)} />
          : <input value={value} onChange={(event) => updatePayload(key, event.target.value)} />}</label>
      })}
      <label>Display order<input type="number" min="0" value={editing.order} onChange={(event) => setEditing({ ...editing, order: event.target.value })} /></label>
      <label className="stage-two-checkbox"><input type="checkbox" checked={editing.enabled} onChange={(event) => setEditing({ ...editing, enabled: event.target.checked })} />Enable section when published</label>
      {formError && <p className="stage-two-error" role="alert">{formError}</p>}
      <div className="stage-two-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button type="button" disabled={Boolean(busyKey)} onClick={() => void saveDraft(false)}>Save draft</button><button className="stage-two-button-primary" type="button" disabled={Boolean(busyKey)} onClick={() => void saveDraft(true)}>{busyKey ? 'Saving…' : 'Save and publish'}</button></div>
    </section></div>}
    {preview && <div className="media-lightbox" role="dialog" aria-modal="true" aria-label={`Preview ${preview.label}`} onClick={() => setPreview(null)}>
      <button type="button" aria-label="Close preview" onClick={() => setPreview(null)}>×</button>
      <section className="content-preview" onClick={(event) => event.stopPropagation()}>
        {preview.draft_payload.image_key && <img src={resolveImage(preview.draft_payload.image_key)} alt={preview.draft_payload.alt_text || preview.label} />}
        <p>{preview.draft_payload.season || preview.draft_payload.tag || preview.label}</p>
        <h2>{preview.draft_payload.headline || preview.draft_payload.title || preview.label}</h2>
        <p>{preview.draft_payload.description || preview.draft_payload.summary || preview.draft_payload.alt_text}</p>
        <p className="content-preview-status">Draft preview · not published</p>
      </section>
    </div>}
  </section>
}
