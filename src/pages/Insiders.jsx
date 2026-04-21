import { useWixAuth } from '../hooks/useWixAuth.js'
import { useWixGroups } from '../hooks/useWixGroups.js'
import { StarIcon, UserCircleIcon, ChevronRightIcon } from '../components/Icons.jsx'
import GroupFeed from '../components/GroupFeed.jsx'

// ── Sub-components ────────────────────────────────────────────────────────────

/** Shown when Wix Client ID is not yet configured */
function NotConfigured() {
  return (
    <div className="px-4 mt-8 text-center">
      <div className="card p-6 border-amber-200 bg-amber-50">
        <p className="text-2xl mb-2">⚙️</p>
        <h3 className="font-display font-semibold text-stone-700 mb-2">Groups not configured</h3>
        <p className="text-xs text-stone-500 leading-relaxed">
          Add <code className="bg-stone-100 px-1 rounded">VITE_WIX_CLIENT_ID</code> and{' '}
          <code className="bg-stone-100 px-1 rounded">VITE_WIX_INSIDERS_GROUP_ID</code> to your{' '}
          <code className="bg-stone-100 px-1 rounded">.env</code> file, then create an OAuth App in your Wix dashboard.
        </p>
      </div>
    </div>
  )
}

/** Unauthenticated users — sign-in prompt */
function SignInPrompt({ onLogin, loading }) {
  const perks = [
    { icon: '🎬', label: 'Stream Replays',         desc: 'Rewatch every craft-along' },
    { icon: '📄', label: 'Downloadable Printables', desc: 'Patterns, prayer cards & guides' },
    { icon: '🎥', label: 'Monthly Zoom Night',      desc: 'Live craft session, members only' },
    { icon: '⭐', label: 'Insider Pricing',          desc: 'Member-only discounts on all kits' },
  ]

  return (
    <div className="animate-fade-in">
      {/* Perks list */}
      <section className="px-4 mt-6 space-y-3">
        {perks.map((perk, i) => (
          <div key={i} className="card flex gap-4 p-4">
            <span className="text-xl flex-shrink-0 w-8 text-center">{perk.icon}</span>
            <div>
              <p className="font-semibold text-burgundy-800 text-sm">{perk.label}</p>
              <p className="text-xs text-stone-500 mt-0.5">{perk.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="px-4 mt-6">
        <div className="card p-6 text-center bg-burgundy-50 border-burgundy-100">
          <h3 className="font-display font-semibold text-burgundy-800 mb-2 text-lg">
            Ready to join the community?
          </h3>
          <p className="text-sm text-stone-500 mb-5 leading-relaxed">
            Sign in with your Wix account to access the Insiders group, stream replays, and exclusive member content.
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
      </section>
    </div>
  )
}

/** Authenticated member who is NOT yet in the group (or pending) */
function JoinPrompt({ currentMember, groupInfo, membershipStatus, onJoin, actionLoading, error }) {
  const isPending = membershipStatus === 'pending'

  return (
    <div className="px-4 mt-6 space-y-4 animate-fade-in">
      {/* Member greeting */}
      <div className="card p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-burgundy-100 flex items-center justify-center flex-shrink-0">
          {currentMember?.profile?.photo?.url ? (
            <img
              src={currentMember.profile.photo.url}
              alt={currentMember.profile?.nickname || 'You'}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <UserCircleIcon className="w-7 h-7 text-burgundy-500" />
          )}
        </div>
        <div>
          <p className="font-semibold text-burgundy-800 text-sm">
            Welcome, {currentMember?.profile?.nickname ?? currentMember?.contact?.firstName ?? 'Friend'}!
          </p>
          <p className="text-xs text-stone-400">Signed in with Wix</p>
        </div>
      </div>

      {/* Group info card */}
      {groupInfo && (
        <div className="card overflow-hidden">
          {groupInfo.coverImage && (
            <img
              src={groupInfo.coverImage}
              alt={groupInfo.name}
              className="w-full h-36 object-cover"
            />
          )}
          <div className="p-4">
            <h3 className="font-display font-semibold text-burgundy-800 text-base">{groupInfo.name}</h3>
            {groupInfo.description && (
              <p className="text-sm text-stone-500 mt-1 line-clamp-3">{groupInfo.description}</p>
            )}
            <p className="text-xs text-stone-400 mt-2">
              👥 {groupInfo.memberCount.toLocaleString()} members
              {groupInfo.privacyStatus === 'PRIVATE' && ' · Private group'}
            </p>
          </div>
        </div>
      )}

      {/* Join CTA */}
      <div className="card p-5 text-center bg-burgundy-50 border-burgundy-100">
        {isPending ? (
          <>
            <p className="text-2xl mb-2">⏳</p>
            <h3 className="font-display font-semibold text-burgundy-800 mb-2">Request pending</h3>
            <p className="text-sm text-stone-500 leading-relaxed">
              Your request to join <strong>The Rustic Vine Insiders</strong> is waiting for approval.
              You'll get access as soon as Lisa approves it!
            </p>
          </>
        ) : (
          <>
            <StarIcon className="w-8 h-8 text-gold mx-auto mb-3" />
            <h3 className="font-display font-semibold text-burgundy-800 mb-2">
              Join the Insiders Group
            </h3>
            <p className="text-sm text-stone-500 mb-4 leading-relaxed">
              Connect with fellow crafters, get early access to new kits, and join our monthly Zoom nights.
            </p>
            {error && (
              <p className="text-xs text-red-500 mb-3">{error}</p>
            )}
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
                <>
                  <StarIcon className="w-4 h-4" />
                  Request to Join
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Member avatar — shown in the community grid */
function MemberAvatar({ member, index }) {
  const initials = member.name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const bgColors = [
    'bg-burgundy-700', 'bg-sage-600', 'bg-vine-600',
    'bg-burgundy-500', 'bg-sage-500', 'bg-vine-500',
  ]
  const bg = bgColors[index % bgColors.length]

  const joinedLabel = member.joinedDate
    ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
        -Math.floor((Date.now() - new Date(member.joinedDate)) / 86400000),
        'day'
      )
    : ''

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="relative">
        {member.photo ? (
          <img
            src={member.photo}
            alt={member.name}
            className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-warm"
          />
        ) : (
          <div className={`w-14 h-14 rounded-full ${bg} flex items-center justify-center text-cream font-bold text-sm border-2 border-white shadow-warm`}>
            {initials}
          </div>
        )}
        {member.role && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-gold rounded-full border border-white flex items-center justify-center">
            <span className="text-[8px]">⭐</span>
          </div>
        )}
      </div>
      <p className="text-xs text-stone-600 font-medium leading-tight max-w-[60px] line-clamp-1">
        {member.name.split(' ')[0]}
      </p>
    </div>
  )
}

/** Full member experience — group feed + community grid */
function MemberContent({ currentMember, groupInfo, recentMembers, onLogout, tokens }) {
  const displayName = currentMember?.profile?.nickname
    ?? currentMember?.contact?.firstName
    ?? 'Friend'

  return (
    <div className="animate-fade-in pb-4">
      {/* Member status bar */}
      <div className="mx-4 mt-4 card p-3 flex items-center justify-between bg-sage-50 border-sage-200">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sage-500 animate-live-dot" />
          <span className="text-sm font-semibold text-sage-800">
            ✓ Insider Member — {displayName}
          </span>
        </div>
        <button
          id="insiders-logout-btn"
          onClick={onLogout}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Group stats */}
      {groupInfo && (
        <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
          <div className="card p-4 text-center">
            <p className="font-display text-2xl font-bold text-burgundy-800">
              {groupInfo.memberCount.toLocaleString()}
            </p>
            <p className="text-xs text-stone-500 mt-0.5">Members</p>
          </div>
          <div className="card p-4 text-center">
            <p className="font-display text-2xl font-bold text-burgundy-800">
              {recentMembers.length}
            </p>
            <p className="text-xs text-stone-500 mt-0.5">Recently joined</p>
          </div>
        </div>
      )}

      {/* Community member grid */}
      {recentMembers.length > 0 && (
        <section className="mt-5 px-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-burgundy-800 text-base">
              Recently Joined
            </h2>
            <span className="text-xs text-stone-400">Your community</span>
          </div>
          <div className="card p-4">
            <div className="grid grid-cols-5 gap-3 sm:grid-cols-6">
              {recentMembers.map((m, i) => (
                <MemberAvatar key={m.id || i} member={m} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Group Feed — live posts from the Wix Insiders group */}
      <GroupFeed tokens={tokens} enabled={true} />

      {/* Group links */}
      <section className="mt-4 px-4 space-y-2">
        <h2 className="font-display font-semibold text-burgundy-800 text-base mb-3">
          Member Resources
        </h2>

        {[
          { emoji: '🎬', label: 'Stream Replays',          sub: 'Watch past craft-alongs',        href: 'https://www.therustic-vine.com/insiders/replays' },
          { emoji: '📄', label: 'Downloadable Printables', sub: 'Patterns, prayer cards & guides', href: 'https://www.therustic-vine.com/insiders/printables' },
          { emoji: '✍️', label: 'Exclusive Blog Posts',    sub: 'Behind the scenes with Lisa',    href: 'https://www.therustic-vine.com/insiders/blog' },
          { emoji: '🎥', label: 'Monthly Zoom Night',      sub: 'Live craft session — members only', href: 'https://www.therustic-vine.com/insiders/zoom' },
        ].map((item, i) => (
          <a
            key={i}
            id={`insider-resource-${i}`}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="card flex items-center gap-4 p-4 hover:shadow-warm-lg"
          >
            <span className="text-xl flex-shrink-0">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-burgundy-800 text-sm">{item.label}</p>
              <p className="text-xs text-stone-500 mt-0.5">{item.sub}</p>
            </div>
            <ChevronRightIcon className="w-4 h-4 text-stone-300 flex-shrink-0" />
          </a>
        ))}
      </section>
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function InsidersSkeleton() {
  return (
    <div className="px-4 mt-6 space-y-3 animate-fade-in">
      {[1,2,3,4].map(i => (
        <div key={i} className="skeleton h-16 rounded-2xl" />
      ))}
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
    <main id="insiders-page" className="min-h-screen bg-cream pb-6">
      {/* Hero header */}
      <div className="bg-vine-gradient pt-14 pb-8 px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-gold/20 text-gold-light rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-3">
          <StarIcon className="w-3.5 h-3.5" />
          VIP Insiders
        </div>
        <h1 className="font-display text-cream text-3xl font-bold mb-2 leading-tight">
          Crafted with Community
        </h1>
        <p className="text-cream/80 text-sm leading-relaxed max-w-xs mx-auto">
          {showContent
            ? `You're part of the inner circle. Welcome to ${groups.groupInfo?.name ?? 'The Rustic Vine Insiders'}.`
            : 'A faith-filled circle of makers who craft, grow, and pray together.'}
        </p>

        {/* Member count pill */}
        {groups.groupInfo && (
          <div className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 mt-3 text-xs text-cream/90">
            👥 {groups.groupInfo.memberCount.toLocaleString()} members
          </div>
        )}
      </div>

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
          recentMembers={groups.recentMembers}
          onLogout={auth.logout}
          tokens={auth.tokens}
        />
      )}
    </main>
  )
}
