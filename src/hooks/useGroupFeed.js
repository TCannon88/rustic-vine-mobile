/**
 * useGroupFeed — fetches Wix Insiders group feed posts via CF Worker
 *
 * Posts are cached in KV for 5 minutes server-side.
 * On the client we add a 5-minute in-memory cache too.
 */
import { useState, useEffect, useRef } from 'react'

const CF_WORKER_URL = import.meta.env.VITE_CF_WORKER_URL || 'http://localhost:8787'

// In-memory cache so navigating away and back doesn't re-fetch
let _cache = null
let _cacheTs = 0
const CLIENT_TTL = 5 * 60 * 1000

export function useGroupFeed({ enabled = true, limit = 20 } = {}) {
  const [posts,   setPosts]   = useState(_cache?.posts ?? [])
  const [loading, setLoading] = useState(!_cache)
  const [error,   setError]   = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    // Client-side cache still fresh?
    if (_cache && Date.now() - _cacheTs < CLIENT_TTL) {
      setPosts(_cache.posts)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    async function fetchFeed() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `${CF_WORKER_URL}/group-feed?limit=${limit}`,
          {
            signal:  controller.signal,
            headers: { 'Accept': 'application/json' },
          }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        if (data.error) {
          // Worker returned a soft error (e.g. not configured)
          setError(data.error)
          setPosts([])
        } else {
          _cache   = data
          _cacheTs = Date.now()
          setPosts(data.posts ?? [])
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('[useGroupFeed]', e)
          setError('Could not load the group feed right now.')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchFeed()
    return () => controller.abort()
  }, [enabled, limit])

  /** Call this to force-refresh (e.g. pull-to-refresh) */
  function refresh() {
    _cache   = null
    _cacheTs = 0
    setLoading(true)
    setError(null)
  }

  return { posts, loading, error, refresh }
}
