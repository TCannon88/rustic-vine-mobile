/**
 * GroupFeed — renders Insiders group posts fetched from the CF Worker.
 *
 * Shows a card per post: author avatar, name, timestamp, content text,
 * optional image, and reaction/comment counts.
 * Tapping a post opens it on therustic-vine.com in a new tab.
 */
import { useGroupFeed } from '../hooks/useGroupFeed.js'
import { UserCircleIcon } from './Icons.jsx'

// ── Relative time helper ──────────────────────────────────────────────────────
function relativeTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  <  2) return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  <  7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Single post card ─────────────────────────────────────────────────────────
function PostCard({ post }) {
  return (
    <a
      href={post.groupUrl}
      target="_blank"
      rel="noopener noreferrer"
      id={`group-post-${post.id}`}
      className="block card p-4 hover:shadow-warm-lg transition-shadow duration-200"
    >
      {/* Author row */}
      <div className="flex items-center gap-2.5 mb-3">
        {post.authorPhoto ? (
          <img
            src={post.authorPhoto}
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
        {/* External link hint */}
        <span className="text-stone-300 text-xs flex-shrink-0">↗</span>
      </div>

      {/* Post content */}
      {post.content && (
        <p className="text-sm text-stone-700 leading-relaxed line-clamp-4 mb-3">
          {post.content}
        </p>
      )}

      {/* Media image */}
      {post.mediaUrl && (
        <div className="rounded-xl overflow-hidden mb-3 bg-sand-100">
          <img
            src={post.mediaUrl}
            alt="Post media"
            className="w-full max-h-56 object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Reactions + comments footer */}
      {(post.totalReactions > 0 || post.commentCount > 0) && (
        <div className="flex items-center gap-4 pt-2 border-t border-sand-100 text-xs text-stone-400">
          {post.totalReactions > 0 && (
            <span>❤️ {post.totalReactions}</span>
          )}
          {post.commentCount > 0 && (
            <span>💬 {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}</span>
          )}
        </div>
      )}
    </a>
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
export default function GroupFeed({ enabled = true }) {
  const { posts, loading, error, refresh } = useGroupFeed({ enabled, limit: 20 })

  return (
    <section id="group-feed-section" className="mt-5 px-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-burgundy-800 text-base">
          Group Feed
        </h2>
        <button
          onClick={refresh}
          id="group-feed-refresh-btn"
          className="text-xs text-sage-500 hover:text-sage-600 font-medium transition-colors"
        >
          ↺ Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && <FeedSkeleton />}

      {/* Error / not configured */}
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
          <p className="text-sm text-stone-500">No posts yet — be the first to share!</p>
          <a
            href="https://www.therustic-vine.com/groups"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-xs text-sage-600 font-semibold"
          >
            Open in Wix →
          </a>
        </div>
      )}

      {/* Posts */}
      {!loading && posts.length > 0 && (
        <div className="space-y-3">
          {posts.map((post, i) => (
            <PostCard key={post.id ?? i} post={post} />
          ))}

          {/* Footer link */}
          <a
            href="https://www.therustic-vine.com/groups"
            target="_blank"
            rel="noopener noreferrer"
            id="group-feed-see-all"
            className="flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-sage-600 hover:text-sage-700 transition-colors"
          >
            See all posts in the group ↗
          </a>
        </div>
      )}
    </section>
  )
}
