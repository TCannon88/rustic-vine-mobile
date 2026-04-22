import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LivePlayer from '../components/LivePlayer.jsx'
import ChatPanel from '../components/ChatPanel.jsx'
import { useMuxStream } from '../hooks/useMuxStream.js'
import { useWixAuth } from '../hooks/useWixAuth.js'
import { useWixGroups } from '../hooks/useWixGroups.js'
import { ArrowLeftIcon, PlayCircleIcon, StarIcon, LockIcon } from '../components/Icons.jsx'
import logo from '../assets/logo.png'

// ── Membership gate ───────────────────────────────────────────────────────────
function MembershipGate({ isLoggedIn, authLoading, membershipStatus, groupsLoading }) {
  const navigate = useNavigate()
  const isChecking = authLoading || groupsLoading

  // Determine copy based on state
  const { headline, sub, cta, ctaId } = (() => {
    if (isChecking) {
      return {
        headline: 'Checking your membership…',
        sub:      '',
        cta:      null,
      }
    }
    if (!isLoggedIn) {
      return {
        headline: 'Insiders Only',
        sub:      'The live stream is an exclusive perk for Rustic Vine Insiders members. Sign in or join to watch Lisa craft live.',
        cta:      'Sign In to Watch',
        ctaId:    'live-gate-signin-btn',
      }
    }
    // logged in but not a member (or still pending)
    if (membershipStatus === 'pending') {
      return {
        headline: 'Request Pending',
        sub:      'Your Insiders membership request is awaiting approval. Once approved you\'ll have full access to the live stream.',
        cta:      'View Insiders Status',
        ctaId:    'live-gate-pending-btn',
      }
    }
    return {
      headline: 'Join the Insiders',
      sub:      'The live stream is exclusive to Rustic Vine Insiders members. Request to join — it\'s free for members!',
      cta:      'Request to Join',
      ctaId:    'live-gate-join-btn',
    }
  })()

  return (
    <div
      id="live-gate"
      className="flex flex-col items-center justify-center min-h-screen px-8 text-center"
      style={{ background: 'linear-gradient(160deg, #3a4f3a 0%, #4e6150 50%, #647a62 100%)' }}
    >
      {/* Logo */}
      <img
        src={logo}
        alt="The Rustic Vine"
        className="w-28 h-28 object-contain mix-blend-screen mb-2"
      />

      {/* Lock icon badge */}
      <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center mb-6 border border-white/20">
        {isChecking
          ? <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          : <LockIcon className="w-7 h-7 text-white" />
        }
      </div>

      {/* Label */}
      <div className="flex items-center gap-2 mb-3">
        <StarIcon className="w-4 h-4 text-gold" />
        <span className="text-xs font-bold uppercase tracking-widest text-gold">
          VIP Insiders
        </span>
      </div>

      <h1 className="font-display text-white text-2xl font-semibold mb-3 text-balance leading-snug">
        {headline}
      </h1>

      {sub && (
        <p className="text-white/70 text-sm leading-relaxed mb-8 max-w-xs">
          {sub}
        </p>
      )}

      {/* Perks reminder */}
      {!isChecking && (
        <div className="w-full max-w-xs bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-8 border border-white/20 text-left space-y-2">
          {[
            '🎥  Live craft-alongs with Lisa',
            '💬  Real-time community chat',
            '🛍️  In-stream exclusive deals',
            '⭐  Stream replays & printables',
          ].map(perk => (
            <p key={perk} className="text-white/85 text-sm">{perk}</p>
          ))}
        </div>
      )}

      {/* CTA */}
      {cta && (
        <button
          id={ctaId}
          onClick={() => navigate('/insiders')}
          className="w-full max-w-xs py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 active:scale-95"
          style={{ background: '#8DA089', color: '#fff' }}
        >
          {cta} →
        </button>
      )}

      <Link
        to="/"
        className="mt-5 text-white/50 text-xs hover:text-white/80 transition-colors"
      >
        ← Back to Home
      </Link>
    </div>
  )
}

// ── Offline State ─────────────────────────────────────────────────────────────
function StreamOffline() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-900 px-8 text-center">
      <img
        src={logo}
        alt="The Rustic Vine"
        className="w-28 h-28 object-contain mix-blend-screen mb-6 animate-pulse-slow"
      />
      <h2 className="font-display text-white text-2xl font-semibold mb-2">
        No stream right now
      </h2>
      <p className="text-white/60 text-sm mb-8 leading-relaxed max-w-xs">
        Lisa will go live soon! Make sure push notifications are on so you never miss a craft-along.
      </p>
      <Link to="/" id="live-back-home-btn" className="btn-gold px-8">
        ← Back to Home
      </Link>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Live() {
  const { playbackUrl } = useMuxStream()
  const { isLoggedIn, tokens, currentMember, loading: authLoading } = useWixAuth()
  const { membershipStatus, loading: groupsLoading } = useWixGroups({
    tokens,
    currentMember,
    enabled: isLoggedIn,          // skip group check if not logged in
  })

  const [chatOpen, setChatOpen]               = useState(true)
  const [featuredProduct, setFeaturedProduct] = useState(null)

  const hasStream    = !!playbackUrl
  const isMember     = membershipStatus === 'member'
  const stillChecking = authLoading || (isLoggedIn && groupsLoading)

  // Gate: show lock screen if not a confirmed Insider (or still resolving)
  const showGate = stillChecking || !isLoggedIn || !isMember

  if (showGate) {
    return (
      <MembershipGate
        isLoggedIn={isLoggedIn}
        authLoading={authLoading}
        membershipStatus={membershipStatus}
        groupsLoading={groupsLoading}
      />
    )
  }

  // Confirmed Insider — show player (or offline screen if no stream)
  if (!hasStream) {
    return <StreamOffline />
  }

  return (
    <div id="live-page" className="flex flex-col h-screen bg-black overflow-hidden">
      {/* Back nav — minimal overlay */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3 pt-safe">
        <Link
          to="/"
          id="live-nav-back"
          className="mt-3 p-2 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
          aria-label="Back to home"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>

        <div className="mt-3 flex gap-2">
          <button
            id="chat-toggle-btn"
            onClick={() => setChatOpen(c => !c)}
            className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-semibold hover:bg-black/60 transition-colors"
          >
            💬 {chatOpen ? 'Hide Chat' : 'Show Chat'}
          </button>
        </div>
      </div>

      {/* Player */}
      <div className="flex-1 min-h-0">
        <LivePlayer
          playbackUrl={playbackUrl}
          onFeaturedProduct={setFeaturedProduct}
        />
      </div>

      {/* Chat panel */}
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        accessToken={tokens?.accessToken?.value ?? null}
      />

      {/* Bottom safe area buffer */}
      <div className="h-safe-bottom bg-black" />
    </div>
  )
}
