import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const ManagedSiteContext = createContext(null)

export function ManagedSiteProvider({ children }) {
  const [assets, setAssets] = useState([])
  const [content, setContent] = useState([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState(supabase ? '' : 'Supabase is not configured.')

  const refresh = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const [assetResult, contentResult] = await Promise.all([
      supabase.from('media_assets').select('*').order('display_order').order('asset_name'),
      supabase.from('website_content').select('*').order('display_order').order('content_key')
    ])
    const loadError = assetResult.error || contentResult.error
    if (loadError) {
      setError(loadError.message || 'Managed website content could not be loaded.')
    } else {
      setAssets(assetResult.data || [])
      setContent(contentResult.data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const resolveImage = useCallback((assetKey, fallback = '') => {
    const asset = assets.find((item) => item.asset_key === assetKey)
    if (!asset) return fallback
    if (asset.storage_path && supabase) {
      return supabase.storage.from('product-images').getPublicUrl(asset.storage_path).data.publicUrl
    }
    return asset.external_url || fallback
  }, [assets])

  const getPublishedContent = useCallback((contentKey) => {
    const row = content.find((item) => item.content_key === contentKey)
    return row?.is_published && row.published_enabled ? row.published_payload : null
  }, [content])

  const getPublishedRows = useCallback((contentType) => content
    .filter((item) => item.content_type === contentType && item.is_published && item.published_enabled)
    .sort((left, right) => left.display_order - right.display_order || left.content_key.localeCompare(right.content_key))
    .map((item) => ({ ...item, payload: item.published_payload })), [content])

  const isContentEnabled = useCallback((contentKey) => {
    const row = content.find((item) => item.content_key === contentKey)
    return row ? row.is_published && row.published_enabled : true
  }, [content])

  const value = useMemo(() => ({
    assets,
    content,
    loading,
    error,
    refresh,
    resolveImage,
    getPublishedContent,
    getPublishedRows,
    isContentEnabled
  }), [assets, content, loading, error, refresh, resolveImage, getPublishedContent, getPublishedRows, isContentEnabled])

  return <ManagedSiteContext.Provider value={value}>{children}</ManagedSiteContext.Provider>
}

export function useManagedSite() {
  const context = useContext(ManagedSiteContext)
  return context || {
    assets: [],
    content: [],
    loading: false,
    error: '',
    refresh: async () => {},
    resolveImage: (_assetKey, fallback = '') => fallback,
    getPublishedContent: () => null,
    getPublishedRows: () => [],
    isContentEnabled: () => true
  }
}
