import { useState } from 'react'
import { usePushSubscription } from '../hooks/usePushSubscription.js'
import { BellIcon, XIcon } from './Icons.jsx'

const DISMISS_KEY    = 'rv:push_prompt_dismissed'
const VISIT_KEY      = 'rv:visit_count'

/**
 * Shows a push notification opt-in banner on the second+ visit.
 * Stores dismissal in localStorage so it doesn't re-appear.
 */
export default function PushOptIn() {
  const { isSubscribed, isSupported, permission, isLoading, subscribe } = usePushSubscription()
  const [dismissed, setDismissed] = useState(() => {
    // Track visit count
    const visits = parseInt(localStorage.getItem(VISIT_KEY) || '0', 10) + 1
    localStorage.setItem(VISIT_KEY, String(visits))

    // Only show on visit 2+
    if (visits < 2) return true
    return localStorage.getItem(DISMISS_KEY) === 'true'
  })

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  // Don't render if: already subscribed, dismissed, not supported, or already denied
  if (dismissed || isSubscribed || !isSupported || permission === 'denied') {
    return null
  }

  return (
    <div
      id="push-opt-in-banner"
      className="mx-4 mb-4 rounded-2xl bg-vine-gradient text-cream p-4 flex gap-3 shadow-warm-lg animate-slide-up"
      role="banner"
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
        <BellIcon className="w-5 h-5 text-gold-light" />
      </div>

      {/* Copy */}
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-sm leading-tight mb-1">
          Never miss a craft-along! 🌿
        </p>
        <p className="text-xs text-cream/80 leading-snug mb-3">
          Get notified when Lisa goes live, new kits drop, and exclusive deals.
        </p>
        <div className="flex gap-2">
          <button
            id="push-subscribe-btn"
            onClick={subscribe}
            disabled={isLoading}
            className="btn-gold text-xs py-1.5 px-4 rounded-full"
          >
            {isLoading ? 'Enabling…' : '🔔 Yes, notify me!'}
          </button>
          <button
            id="push-dismiss-btn"
            onClick={dismiss}
            className="text-xs text-cream/70 hover:text-cream underline underline-offset-2 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>

      {/* Close */}
      <button
        onClick={dismiss}
        className="flex-shrink-0 text-cream/60 hover:text-cream transition-colors"
        aria-label="Dismiss notification prompt"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  )
}
