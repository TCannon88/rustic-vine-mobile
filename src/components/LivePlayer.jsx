import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import { VolumeOffIcon, VolumeUpIcon, ShoppingBagIcon } from './Icons.jsx'
import logo from '../assets/logo.png'

const CF_WORKER_URL = import.meta.env.VITE_CF_WORKER_URL || 'http://localhost:8787'
const POLL_INTERVAL = 30_000 // 30 seconds

/**
 * HLS video player with:
 * - Muted autoplay (satisfies iOS autoplay policy)
 * - HLS.js for Chrome/Firefox; native HLS for Safari
 * - 30-second featured product poll
 * - "Shop This Craft" action button
 */
export default function LivePlayer({ playbackUrl, onFeaturedProduct }) {
  const videoRef              = useRef(null)
  const hlsRef                = useRef(null)
  const pollRef               = useRef(null)
  const [muted, setMuted]     = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isBuffering, setIsBuffering] = useState(true)
  const [featuredProduct, setFeaturedProduct] = useState(null)

  // ── HLS setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video || !playbackUrl) return

    setHasError(false)
    setIsBuffering(true)

    // Destroy previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    if (Hls.isSupported()) {
      // Chrome, Firefox, Android WebView
      const hls = new Hls({
        enableWorker:        true,
        lowLatencyMode:      true,
        backBufferLength:    30,
        maxBufferLength:     60,
        liveSyncDurationCount: 3,
      })

      hls.loadSource(playbackUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.muted = true
        video.play().catch(() => {/* autoplay blocked — user will tap */})
      })

      hls.on(Hls.Events.FRAG_BUFFERED, () => setIsBuffering(false))

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('[LivePlayer] HLS fatal error:', data.type)
          setHasError(true)
        }
      })

      hlsRef.current = hls
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // iOS Safari — native HLS
      video.src    = playbackUrl
      video.muted  = true
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {})
        setIsBuffering(false)
      })
      video.addEventListener('error', () => setHasError(true))
    } else {
      setHasError(true)
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [playbackUrl])

  // ── Sync muted state to video element ────────────────────────────────────
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted
  }, [muted])

  // ── Featured product poll ─────────────────────────────────────────────────
  const fetchFeatured = useCallback(async () => {
    try {
      const res = await fetch(`${CF_WORKER_URL}/featured-product`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return
      const data = await res.json()
      setFeaturedProduct(data)
      onFeaturedProduct?.(data)
    } catch {/* ignore */}
  }, [onFeaturedProduct])

  useEffect(() => {
    if (!playbackUrl) return
    fetchFeatured()
    pollRef.current = setInterval(fetchFeatured, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [playbackUrl, fetchFeatured])

  // ── Render ────────────────────────────────────────────────────────────────
  if (hasError) {
    return (
      <div className="player-wrapper flex flex-col items-center justify-center bg-burgundy-950 text-cream gap-4 p-8">
        <img
          src={logo}
          alt="The Rustic Vine"
          className="w-32 h-32 object-contain mix-blend-screen opacity-90"
        />
        <p className="font-display text-xl italic text-center">Stream not available right now</p>
        <p className="text-sm text-cream/60 text-center">Check back when Lisa goes live!</p>
      </div>
    )
  }

  return (
    <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
      {/* Video element */}
      <video
        ref={videoRef}
        id="live-player-video"
        className="w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Buffering spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="w-12 h-12 border-4 border-cream/30 border-t-cream rounded-full animate-spin" />
        </div>
      )}

      {/* Mute/unmute toggle */}
      <button
        id="player-mute-toggle"
        onClick={() => setMuted(m => !m)}
        className={`absolute top-3 right-3 z-20 flex items-center gap-2 rounded-full px-3 py-2
          ${muted
            ? 'bg-burgundy-700 text-cream animate-bounce-gentle'
            : 'bg-black/40 text-cream'
          }
          backdrop-blur-sm transition-all duration-200`}
        aria-label={muted ? 'Unmute stream' : 'Mute stream'}
      >
        {muted ? <VolumeOffIcon className="w-5 h-5" /> : <VolumeUpIcon className="w-5 h-5" />}
        {muted && <span className="text-xs font-semibold pr-1">Tap to unmute</span>}
      </button>

      {/* LIVE badge */}
      <div className="absolute top-3 left-3 z-20">
        <span className="badge-live">
          <span className="w-2 h-2 rounded-full bg-white animate-live-dot" />
          LIVE
        </span>
      </div>

      {/* Shop This Craft button — pinned at bottom of player */}
      {featuredProduct && (
        <a
          id="shop-this-craft-btn"
          href={featuredProduct.checkoutUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20
            flex items-center gap-2
            bg-gold text-burgundy-900 font-bold text-sm
            px-5 py-2.5 rounded-full shadow-gold
            hover:bg-gold-light transition-all duration-200 animate-slide-up
            whitespace-nowrap"
        >
          <ShoppingBagIcon className="w-4 h-4" />
          Shop This Craft — {featuredProduct.name}
        </a>
      )}
    </div>
  )
}

function PlayIcon() {
  return (
    <svg className="w-8 h-8 text-cream" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}
