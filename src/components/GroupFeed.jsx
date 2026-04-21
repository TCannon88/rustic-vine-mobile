/**
 * GroupFeed — live Insiders group post feed via useInsidersFeed.
 *
 * Props:
 *   tokens        — Wix OAuth tokens (from useWixAuth)
 *   enabled       — only fetch when the user is an authenticated Insider
 *   groupId       — Wix group ID (used to build deep-links)
 */
import { useState } from 'react'
import { useInsidersFeed } from '../hooks/useInsidersFeed.js'
import { UserCircleIcon } from './Icons.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(dateStr) {
  if (!dateStr) return ''
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  <  2) return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  <  7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Single post card ──────────────────────────────────────────────────────────
function PostCard({ post }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = post.content?.length >= 277  // truncated at 277 chars + '…'

  return (
    <article
      id={`feed-post-${post.id}`}
      className="card p-4 transition-shadow duration-200 hover:shadow-warm-lg"
    >
      {/* Author row */}
      <div className="flex items-center gap-2.5 mb-3">
        {post.authorAvatar ? (
          <img
            src={post.authorAvatar}
            alt={post.authorName}
            className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-sand-200"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0 border border-sand-200">
            <UserCircleIcon className="w-5 h-5 text-sage-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-stone-800 leading-tight truncate">
            {post.authorName}
          </p>
          <p className="text-xs text-stone-400">{relativeTime(post.createdDate)}</p>
        </div>
        {/* Open in Wix */}
        <a
          href={post.groupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-stone-300 hover:text-sage-500 text-xs transition-colors flex-shrink-0"
          aria-label="Open post on website"
        >
          ↗
        </a>
      </div>

      {/* Post content */}
      {post.content && (
        <div className="mb-3">
          <p className={`text-sm text-stone-700 leading-relaxed ${expanded ? '' : 'line-clamp-4'}`}>
            {post.content}
          </p>
          {isLong && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-sage-600 font-semibold mt-1 hover:text-sage-700 transition-colors"
            >
              Read more →
            </button>
          )}
          {isLong && expanded && (
            <a
              href={post.groupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sage-600 font-semibold mt-1 inline-block hover:text-sage-700 transition-colors"
            >
              View full post on website ↗
            </a>
          )}
        </div>
      )}

      {/* Media indicator */}
      {post.hasMedia && (
        <div className="rounded-xl bg-sand-100 border border-sand-200 px-3 py-2 mb-3 flex items-center gap-2">
          <span className="text-base">🖼️</span>
          <a
            href={post.groupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-stone-500 hover:text-sage-600 transition-colors"
          >
            View photo / video on website ↗
          </a>
        </div>
      )}

      {/* Footer — reactions + comments */}
      {(post.likeCount > 0 || post.commentCount > 0) && (
        <div className="flex items-center gap-4 pt-2 border-t border-sand-100 text-xs text-stone-400">
          {post.likeCount > 0 && (
            <span>❤️ {post.likeCount.toLocaleString()}</span>
          )}
          {post.commentCount > 0 && (
            <span>
              💬 {post.commentCount.toLocaleString()}{' '}
              {post.commentCount === 1 ? 'comment' : 'comments'}
            </span>
          )}
        </div>
      )}
    </article>
  )
}

// ── Skeleton loaders ──────────────────────────────────────────────────────────
function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="card p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="skeleton w-9 h-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-3 w-28 rounded" />
              <div className="skeleton h-2.5 w-16 rounded" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-4/5 rounded" />
            <div className="skeleton h-3 w-3/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function GroupFeed({ tokens, enabled = true }) {
  const { posts, loading, error, refresh } = useInsidersFeed({ tokens, enabled })

  return (
    <section id="group-feed-section" className="mt-5 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-burgundy-800 text-base">
          Group Feed
        </h2>
        <button
          id="group-feed-refresh-btn"
          onClick={refresh}
          className="text-xs text-sage-500 hover:text-sage-600 font-medium transition-colors"
        >
          ↺ Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && <FeedSkeleton />}

      {/* Error */}
      {!loading && error && (
        <div className="card p-5 text-center bg-sand-100 border-sand-200">
          <p className="text-2xl mb-2">🌿</p>
          <p className="text-sm font-semibold text-stone-700 mb-1">Feed unavailable</p>
          <p className="text-xs text-stone-400 leading-relaxed mb-3">{error}</p>
          <a
            href="https://www.therustic-vine.com/groups"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sage-600 font-semibold underline underline-offset-2"
          >
            View group on website →
          </a>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && posts.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-2xl mb-2">✍️</p>
          <p className="text-sm text-stone-500 mb-3">
            No posts yet — be the first to share!
          </p>
          <a
            href="https://www.therustic-vine.com/groups"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sage-600 font-semibold"
          >
            Open group in Wix →
          </a>
        </div>
      )}

      {/* Posts list */}
      {!loading && posts.length > 0 && (
        <div className="space-y-3">
          {posts.map((post, i) => (
            <PostCard key={post.id ?? i} post={post} />
          ))}

          {/* Footer link */}
          <a
            id="group-feed-see-all"
            href="https://www.therustic-vine.com/groups"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-sage-600 hover:text-sage-700 transition-colors"
          >
            See all posts in the group ↗
          </a>
        </div>
      )}
    </section>
  )
}
