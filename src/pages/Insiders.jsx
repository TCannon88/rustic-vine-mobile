import { useState } from 'react'
import { useWixAuth } from '../hooks/useWixAuth.js'
import { useWixGroups } from '../hooks/useWixGroups.js'
import { StarIcon, UserCircleIcon } from '../components/Icons.jsx'
import GroupFeed from '../components/GroupFeed.jsx'

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  {
    id:    'discussion',
    label: 'Discussion',
    type:  'internal',
  },
  {
    id:    'events',
    label: 'Monthly Events',
    type:  'external',
    href:  'https://www.therustic-vine.com/group/rustic-vine-insiders/custom/custom_app_2',
  },
  {
    id:    'media',
    label: 'Media',
    type:  'external',
    href:  'https://www.therustic-vine.com/group/rustic-vine-insiders/media',
  },
  {
    id:    'members',
    label: 'Members',
    type:  'external',
    href:  'https://www.therustic-vine.com/group/rustic-vine-insiders/members',
  },
  {
    id:    'replays',
    label: 'Live Replays',
    type:  'external',
    href:  'https://www.therustic-vine.com/group/rustic-vine-insiders/custom',
  },
]

// ── Banner + group header (shown for all states) ──────────────────────────────
function GroupHeader({ groupInfo }) {
  return (
    <div>
      {/* Banner */}
      <div className="w-full overflow-hidden">
        <img
          src="/RusticVineInsiders.png"
          alt="Rustic Vine Insiders"
          className="w-full object-contain"
        />
      </div>

      {/* Group name + member count row */}
      <div className="px-4 pt-3 pb-2">
        <h1 className="font-display text-lg font-bold text-stone-800 leading-tight">
          Rustic Vine Insiders
        </h1>
        <p className="text-xs text-stone-500 mt-0.5">
          Paying members
          {groupInfo?.memberCount ? ` · ${groupInfo.memberCount.toLocaleString()} members` : ''}
        </p>
      </div>
    </div>
  )
}

// ── Horizontal tab bar ────────────────────────────────────────────────────────
function TabBar({ activeTab, onTabClick }) {
  return (
    <div
      className="border-b border-stone-200 bg-white sticky top-0 z-10"
      style={{ marginTop: 0 }}
    >
      <div
        className="flex overflow-x-auto"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {TABS.map(tab => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              id={`insiders-tab-${tab.id}`}
              onClick={() => onTabClick(tab)}
              className={`
                flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap
                border-b-2 transition-colors duration-150
                ${isActive
                  ? 'border-stone-800 text-stone-800'
                  : 'border-transparent text-stone-500 hover:text-stone-700'}
              `}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── External tab placeholder card ─────────────────────────────────────────────
function ExternalTabContent({ tab }) {
  const meta = {
    events:  { emoji: '📅', desc: 'View the monthly events calendar and upcoming craft sessions.' },
    media:   { emoji: '🖼️', desc: 'Browse photos and videos shared by the Insiders community.' },
    members: { emoji: '👥', desc: 'See all paying members of the Rustic Vine Insiders group.' },
    replays: { emoji: '🎬', desc: 'Watch replays of past live craft-along sessions with Lisa.' },
  }[tab.id] ?? { emoji: '🔗', desc: 'View this section on the Rustic Vine website.' }

  return (
    <div className="px-4 pt-6">
      <div className="card p-6 text-center">
        <p className="text-3xl mb-3">{meta.emoji}</p>
        <h2 className="font-display font-semibold text-stone-800 text-base mb-2">
          {tab.label}
        </h2>
        <p className="text-sm text-stone-500 leading-relaxed mb-5">
          {meta.desc}
        </p>
        <a
          href={tab.href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary inline-flex items-center gap-2"
        >
          Open in browser ↗
        </a>
      </div>
    </div>
  )
}

// ── Sign-in prompt (unauthenticated) ──────────────────────────────────────────
function SignInPrompt({ onLogin, loading }) {
  return (
    <div className="px-4 pt-5 animate-fade-in">
      <div className="card p-6 text-center bg-burgundy-50 border-burgundy-100">
        <StarIcon className="w-8 h-8 text-gold mx-auto mb-3" />
        <h2 className="font-display font-semibold text-burgundy-800 mb-2 text-lg">
          Members only
        </h2>
        <p className="text-sm text-stone-500 mb-5 leading-relaxed">
          Sign in with your Wix account to access the Insiders group, stream replays,
          and exclusive member content.
        </p>
        <button
          id="insiders-sign-in-btn"
          onClick={onLogin}
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
              Redirecting to Wix…
            </span>
          ) : (
            '🔑 Sign in with Wix'
          )}
        </button>
        <p className="text-xs text-stone-400 mt-3">
          Uses your existing Wix / The Rustic Vine account.
        </p>
      </div>

      {/* Perks */}
      <div className="mt-4 space-y-2">
        {[
          { icon: '🎬', label: 'Stream Replays',         desc: 'Rewatch every craft-along' },
          { icon: '📅', label: 'Monthly Events',          desc: 'Craft calendar & Zoom nights' },
          { icon: '🖼️', label: 'Member Media',            desc: 'Photos & videos from the group' },
          { icon: '⭐', label: 'Insider Community',        desc: 'Connect with fellow crafters' },
        ].map((p, i) => (
          <div key={i} className="card flex gap-4 p-4 items-center">
            <span className="text-xl flex-shrink-0 w-8 text-center">{p.icon}</span>
            <div>
              <p className="font-semibold text-stone-800 text-sm">{p.label}</p>
              <p className="text-xs text-stone-500 mt-0.5">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Join prompt (logged in, not a member) ─────────────────────────────────────
function JoinPrompt({ currentMember, groupInfo, membershipStatus, onJoin, actionLoading, error }) {
  const isPending = membershipStatus === 'pending'
  const name = currentMember?.profile?.nickname ?? currentMember?.contact?.firstName ?? 'Friend'

  return (
    <div className="px-4 pt-5 space-y-4 animate-fade-in">
      {/* Welcome back */}
      <div className="card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-burgundy-100 flex items-center justify-center flex-shrink-0">
          {currentMember?.profile?.photo?.url ? (
            <img
              src={currentMember.profile.photo.url}
              alt={name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <UserCircleIcon className="w-6 h-6 text-burgundy-500" />
          )}
        </div>
        <div>
          <p className="font-semibold text-stone-800 text-sm">Welcome back, {name}!</p>
          <p className="text-xs text-stone-400">Signed in with Wix</p>
        </div>
      </div>

      {/* Join / pending */}
      <div className="card p-5 text-center bg-burgundy-50 border-burgundy-100">
        {isPending ? (
          <>
            <p className="text-2xl mb-2">⏳</p>
            <h3 className="font-display font-semibold text-burgundy-800 mb-2">Request pending</h3>
            <p className="text-sm text-stone-500 leading-relaxed">
              Your request to join <strong>Rustic Vine Insiders</strong> is waiting for Lisa's approval.
            </p>
          </>
        ) : (
          <>
            <StarIcon className="w-8 h-8 text-gold mx-auto mb-3" />
            <h3 className="font-display font-semibold text-burgundy-800 mb-2">
              Join the Insiders Group
            </h3>
            <p className="text-sm text-stone-500 mb-4 leading-relaxed">
              Connect with fellow crafters, access stream replays, and join monthly Zoom nights.
            </p>
            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
            <button
              id="insiders-join-group-btn"
              onClick={onJoin}
              disabled={actionLoading}
              className="btn-primary w-full"
            >
              {actionLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                  Sending request…
                </span>
              ) : (
                <><StarIcon className="w-4 h-4" /> Request to Join</>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Member content (tabbed) ───────────────────────────────────────────────────
function MemberContent({ currentMember, groupInfo, onLogout, tokens }) {
  const [activeTab, setActiveTab] = useState('discussion')

  const displayName = currentMember?.profile?.nickname
    ?? currentMember?.contact?.firstName
    ?? 'Member'

  function handleTabClick(tab) {
    if (tab.type === 'external') {
      window.open(tab.href, '_blank', 'noopener,noreferrer')
      // Keep active tab as discussion so UI doesn't look broken
    } else {
      setActiveTab(tab.id)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Member status strip */}
      <div className="px-4 py-2 bg-sage-50 border-b border-sage-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sage-500 animate-live-dot" />
          <span className="text-xs font-medium text-sage-800">✓ Insider · {displayName}</span>
        </div>
        <button
          id="insiders-logout-btn"
          onClick={onLogout}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Tab bar */}
      <TabBar activeTab={activeTab} onTabClick={handleTabClick} />

      {/* Tab content */}
      <div className="pb-6">
        {activeTab === 'discussion' && (
          <GroupFeed tokens={tokens} enabled={true} />
        )}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function InsidersSkeleton() {
  return (
    <div className="px-4 pt-5 space-y-3 animate-fade-in">
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton h-16 rounded-2xl" />
      ))}
    </div>
  )
}

// ── Not configured ────────────────────────────────────────────────────────────
function NotConfigured() {
  return (
    <div className="px-4 pt-5 text-center">
      <div className="card p-6 border-amber-200 bg-amber-50">
        <p className="text-2xl mb-2">⚙️</p>
        <h3 className="font-display font-semibold text-stone-700 mb-2">Groups not configured</h3>
        <p className="text-xs text-stone-500 leading-relaxed">
          Add <code className="bg-stone-100 px-1 rounded">VITE_WIX_CLIENT_ID</code> and{' '}
          <code className="bg-stone-100 px-1 rounded">VITE_WIX_INSIDERS_GROUP_ID</code> to your{' '}
          <code className="bg-stone-100 px-1 rounded">.env</code> file.
        </p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Insiders() {
  const auth   = useWixAuth()
  const groups = useWixGroups({
    tokens:        auth.tokens,
    currentMember: auth.currentMember,
    enabled:       auth.isLoggedIn,
  })

  const showContent = auth.isLoggedIn && groups.membershipStatus === 'member'
  const showJoin    = auth.isLoggedIn && (groups.membershipStatus === 'none' || groups.membershipStatus === 'pending')
  const showSignIn  = !auth.isLoggedIn
  const pageLoading = auth.loading || (auth.isLoggedIn && groups.loading)

  return (
    <main id="insiders-page" className="min-h-screen bg-cream pt-14">
      {/* Banner + group header — always visible */}
      <GroupHeader groupInfo={groups.groupInfo} />

      {/* Divider */}
      <div className="border-b border-stone-200" />

      {/* Body */}
      {!auth.isConfigured && <NotConfigured />}

      {auth.isConfigured && pageLoading && <InsidersSkeleton />}

      {auth.isConfigured && !pageLoading && showSignIn && (
        <SignInPrompt onLogin={auth.login} loading={auth.loading} />
      )}

      {auth.isConfigured && !pageLoading && showJoin && (
        <JoinPrompt
          currentMember={auth.currentMember}
          groupInfo={groups.groupInfo}
          membershipStatus={groups.membershipStatus}
          onJoin={groups.requestJoin}
          actionLoading={groups.actionLoading}
          error={groups.error}
        />
      )}

      {auth.isConfigured && !pageLoading && showContent && (
        <MemberContent
          currentMember={auth.currentMember}
          groupInfo={groups.groupInfo}
          onLogout={auth.logout}
          tokens={auth.tokens}
        />
      )}
    </main>
  )
}
