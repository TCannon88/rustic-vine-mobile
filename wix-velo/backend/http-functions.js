/**
 * Wix Velo HTTP Function — Insiders Group Feed API
 *
 * File location in Wix editor:  backend/http-functions.js
 * Public URL:  https://www.therustic-vine.com/_functions/insidersFeed
 *
 * Setup checklist (Wix Dashboard → Settings → Secrets Manager):
 *   PWA_FEED_SECRET   — shared secret between Wix and Cloudflare Worker
 *   INSIDERS_GROUP_ID — the Wix group ID (bef244a1-00ba-4504-9a69-5ec417e68983)
 *
 * HOW TO INSTALL:
 *   1. In your Wix site editor, open the Code panel (Dev Mode must be on)
 *   2. Navigate to backend/http-functions.js
 *   3. Paste this entire file (merge if the file already exists)
 *   4. Add the two secrets above in Dashboard → Settings → Secrets Manager
 *   5. Publish your site
 *   6. Test: curl https://www.therustic-vine.com/_functions/insidersFeed \
 *            -H "X-RV-Secret: <your secret>"
 */

import { ok, serverError, forbidden } from 'wix-http-functions';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';

// ── CORS helper ───────────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  'https://app.therustic-vine.com',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-RV-Secret',
    'Content-Type': 'application/json',
  }
}

function jsonResponse(data, status = 200) {
  const body = JSON.stringify(data)
  if (status === 200) return ok({ body, headers: corsHeaders() })
  if (status === 401) return forbidden({ body, headers: corsHeaders() })
  return serverError({ body, headers: corsHeaders() })
}

// ── OPTIONS preflight ─────────────────────────────────────────────────────────
export function options_insidersFeed(request) {
  return ok({ headers: corsHeaders() })
}

// ── GET /insidersFeed ─────────────────────────────────────────────────────────
export async function get_insidersFeed(request) {
  try {
    // 1. Validate shared secret
    const secret   = await getSecret('PWA_FEED_SECRET')
    const incoming = request.headers.get('X-RV-Secret') || ''
    if (!secret || incoming !== secret) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    // 2. Get the group ID from secrets
    const groupId = await getSecret('INSIDERS_GROUP_ID')
    if (!groupId) {
      return jsonResponse({ posts: [], error: 'Group not configured', fetchedAt: new Date().toISOString() })
    }

    // 3. Query posts from the Groups feed collection
    //    Wix stores group feed posts in "Social/Posts" collection.
    //    Each item has: groupId, content, authorId, _createdDate, reactions, commentCount, media
    let posts = []

    try {
      const results = await wixData
        .query('Social/Posts')
        .eq('groupId', groupId)
        .descending('_createdDate')
        .limit(20)
        .include('author')
        .find({ suppressAuth: true })

      posts = results.items.map(normalisePost)
    } catch (queryErr) {
      console.error('wixData query failed, trying fallback:', queryErr.message)

      // Fallback: try the 'Groups/Posts' collection name variant
      try {
        const results2 = await wixData
          .query('Groups/Posts')
          .eq('groupId', groupId)
          .descending('_createdDate')
          .limit(20)
          .find({ suppressAuth: true })

        posts = results2.items.map(normalisePost)
      } catch (fallbackErr) {
        console.error('Fallback query also failed:', fallbackErr.message)
        // Return empty gracefully — do not throw
        posts = []
      }
    }

    return jsonResponse({
      posts,
      groupId,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[insidersFeed] Unexpected error:', err.message)
    return jsonResponse({ posts: [], error: 'Internal error', fetchedAt: new Date().toISOString() })
  }
}

// ── Post normaliser ───────────────────────────────────────────────────────────
function normalisePost(item) {
  // Author
  const author     = item.author || {}
  const authorName = author.nickname
    || author.name?.nick
    || author.name?.full
    || author.loginEmail?.split('@')[0]
    || 'Community Member'
  const authorAvatar = author.picture?.url
    || author.photo?.url
    || author.image?.url
    || null

  // Content — strip any HTML, truncate at 280 chars
  const rawContent = item.content || item.plainContent || item.body || ''
  const plainText  = rawContent.replace(/<[^>]+>/g, '').trim()
  const content    = plainText.length > 280
    ? plainText.slice(0, 277) + '…'
    : plainText

  // Media check — don't expose URLs, just signal presence
  const media    = item.media || item.mediaItems || []
  const hasMedia = Array.isArray(media) ? media.length > 0 : !!media

  // Reactions — sum all reaction counts
  const reactions = item.reactions || item.reactionsSummary || {}
  const likeCount = typeof reactions === 'object'
    ? Object.values(reactions).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)
    : (item.likeCount || 0)

  // Comment count
  const commentCount = item.commentCount || item.totalComments || 0

  // Deep link to the post in the Wix group
  const postId   = item._id || item.id
  const groupUrl = `https://www.therustic-vine.com/groups/${item.groupId || ''}/discussion/${postId || ''}`

  return {
    id:            postId,
    authorName,
    authorAvatar,
    content,
    createdDate:   item._createdDate ? new Date(item._createdDate).toISOString() : null,
    likeCount,
    commentCount,
    hasMedia,
    groupUrl,
  }
}
