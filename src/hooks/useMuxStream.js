import { useState, useEffect, useRef } from 'react'

const PLAYBACK_ID     = import.meta.env.VITE_MUX_PLAYBACK_ID || ''
const CF_WORKER_URL   = import.meta.env.VITE_CF_WORKER_URL || 'http://localhost:8787'

/**
 * Provides Mux stream playback URL and liveness state.
 * Polls the CF Worker for stream liveness every 30 seconds.
 */
export function useMuxStream() {
  const [isLive, setIsLive]           = useState(false)
  const [playbackId, setPlaybackId]   = useState(PLAYBACK_ID)
  const [streamError, setStreamError] = useState(null)
  const pollRef = useRef(null)

  // Check if a live stream is active via the CF Worker
  async function checkLiveness() {
    try {
      const res = await fetch(`${CF_WORKER_URL}/event`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return
      const event = await res.json()

      // Event is "live" if its scheduledDate is within 15 min in the past or future
      if (event?.isLive) {
        setIsLive(true)
        if (event.playbackId) setPlaybackId(event.playbackId)
      } else {
        setIsLive(false)
      }
    } catch {
      // Network error — don't update liveness state
    }
  }

  useEffect(() => {
    checkLiveness()

    // Poll every 30 seconds
    pollRef.current = setInterval(checkLiveness, 30_000)
    return () => clearInterval(pollRef.current)
  }, [])

  const playbackUrl = playbackId
    ? `https://stream.mux.com/${playbackId}.m3u8`
    : null

  return { playbackUrl, playbackId, isLive, streamError }
}
