import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

function getStoreRoute(hash) {
  const route = hash.replace(/^#\/?/, '').split('?')[0]
  return route || 'home'
}

function scrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
}

export default function ScrollToTop() {
  const { pathname } = useLocation()
  const previousPathname = useRef(null)
  const previousStoreRoute = useRef(getStoreRoute(window.location.hash))

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname
      scrollToTop()
    }
  }, [pathname])

  useEffect(() => {
    const handleHashChange = () => {
      const nextStoreRoute = getStoreRoute(window.location.hash)
      if (previousStoreRoute.current !== nextStoreRoute) {
        previousStoreRoute.current = nextStoreRoute
        scrollToTop()
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return null
}
