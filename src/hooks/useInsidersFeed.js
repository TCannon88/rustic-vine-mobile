/**
 * useInsidersFeed — polls the CF Worker /insider-feed endpoint.
 *
 * - Passes the Wix member token in Authorization so the Worker can
 *   reject unauthenticated callers before hitting Wix.
 * - Polls every 60 seconds while the Insiders tab is mounted.
 * - In-memory cache prevents refetch on tab switch within the same session.
 */
import { useState, useEffect, useRef, useCallback } from 'react'

const CF_WORKER_URL  = import.meta.env.VITE_CF_WORKER_URL || 'http://localhost:8787'
const POLL_INTERVAL  = 60_000   // 60 seconds

// Module-level cache — persists across mounts
let _cache   = null
let _cacheTs = 0
const CACHE_TTL = 60_000

export function useInsidersFeed({ tokens, enabled = true }) {
  const [posts,   setPosts]   = useState(_cache?.posts   ?? [])
  const [loading, setLoading] = useState(!_cache && enabled)
  const [error,   setError]   = useState(null)
  const timerRef  = useRef(null)
  const abortRef  = useRef(null)

  const fetchFeed = useCallback(async (force = false) => {
    if (!enabled || !tokens) return

    // Serve from cache if fresh and not a forced refresh
    if (!force && _cache && Date.now() - _cacheTs < CACHE_TTL) {
      setPosts(_cache.posts ?? [])
      setLoading(false)
      return
    }

    // Build member token string for Authorization header
    // Wix tokens object has accessToken property
    const tokenStr = tokens?.accessToken?.value
      ?? tokens?.access_token
      ?? (typeof tokens === 'string' ? tokens : '')

    if (!tokenStr) {
      setError('No member token available.')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`${CF_WORKER_URL}/insider-feed`, {
        signal:  controller.signal,
        headers: {
          'Authorization': `Bearer ${tokenStr}`,
          'Accept':        'application/json',
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json()

      if (data.error && !data.posts?.length) {
        setError(data.error)
        setPosts([])
      } else {
        _cache   = data
        _cacheTs = Date.now()
        setPosts(data.posts ?? [])
        setError(null)
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('[useInsidersFeed]', e.message)
        setError('Could not load the feed right now.')
      }
    } finally {
      setLoading(false)
    }
  }, [enabled, tokens])

  // Initial fetch + polling
  useEffect(() => {
    if (!enabled || !tokens) {
      setLoading(false)
      return
    }

    setLoading(!_cache)
    fetchFeed()

    // Poll every 60 seconds while mounted
    timerRef.current = setInterval(() => fetchFeed(), POLL_INTERVAL)

    return () => {
      clearInterval(timerRef.current)
      abortRef.current?.abort()
    }
  }, [enabled, fetchFeed])

  /** Force a manual refresh (e.g. pull-to-refresh button) */
  function refresh() {
    _cache   = null
    _cacheTs = 0
    setLoading(true)
    setError(null)
    fetchFeed(true)
  }

  return { posts, loading, error, refresh }
}
