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
 *            -H 'X-RV-Secret: <your secret>'
 */

import { ok, serverError, forbidden } from 'wix-http-functions';
import { getSecret } from 'wix-secrets-backend';
import { fetch as veloFetch } from 'wix-fetch';

// ── CORS helper ───────────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',   // tighten to app domain once working
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
export function options_insidersFeed(_request) {
  return ok({ headers: corsHeaders() })
}

// ── GET /insidersFeed ─────────────────────────────────────────────────────────
export async function get_insidersFeed(request) {
  const steps = []   // diagnostic trail — logged on any error

  try {
    // ── Step 1: validate shared secret ────────────────────────────────────────
    steps.push('reading PWA_FEED_SECRET')
    let secret
    try {
      secret = await getSecret('PWA_FEED_SECRET')
    } catch (e) {
      return jsonResponse({ error: 'Server config error: PWA_FEED_SECRET missing', step: steps }, 500)
    }

    steps.push('checking X-RV-Secret header')
    // Velo request.headers is a plain object — use bracket notation, not .get()
    const incoming = (request.headers && (
      request.headers['X-RV-Secret'] ||
      request.headers['x-rv-secret']
    )) || ''

    const s = (secret || '').trim()
    const h = incoming.trim()

    if (s !== h) {
      // Find first differing character position
      let firstDiff = -1
      for (let i = 0; i < Math.max(s.length, h.length); i++) {
        if (s.charCodeAt(i) !== h.charCodeAt(i)) { firstDiff = i; break }
      }
      return jsonResponse({
        error:             'Unauthorized',
        debug_secret_len:  s.length,
        debug_header_len:  h.length,
        debug_first_diff:  firstDiff,                        // char index where they differ
        debug_secret_at:   firstDiff >= 0 ? s.charCodeAt(firstDiff) : null,  // secret char code
        debug_header_at:   firstDiff >= 0 ? h.charCodeAt(firstDiff) : null,  // header char code
        debug_secret_pre:  s.slice(0, 4),                    // first 4 chars of stored secret
        debug_header_pre:  h.slice(0, 4),                    // first 4 chars of incoming header
      }, 401)
    }

    // ── Step 2: read group ID from secrets ────────────────────────────────────
    steps.push('reading INSIDERS_GROUP_ID')
    let groupId
    try {
      groupId = await getSecret('INSIDERS_GROUP_ID')
    } catch (e) {
      // Fall back to the known group ID if secret isn't set yet
      groupId = 'bef244a1-00ba-4504-9a69-5ec417e68983'
      steps.push('INSIDERS_GROUP_ID secret missing — using fallback hardcoded value')
    }

    if (!groupId) {
      return jsonResponse({
        posts: [], error: 'Group ID not configured', fetchedAt: new Date().toISOString()
      })
    }

    // ── Step 3: fetch group posts ─────────────────────────────────────────────
    // Wix stores group feed data internally. We probe all known collection
    // names and internal API paths until one succeeds.
    steps.push('fetching posts')
    let posts = []
    let fetchError = 'all methods failed'

    // ── wixData collection name candidates ────────────────────────────────────
    const collectionCandidates = [
      'SocialGroups/Posts',
      'SocialGroups/FeedItems',
      'Social/FeedItems',
      'Groups/FeedItems',
      'GroupPosts',
      'Posts',
    ]

    const wixData = await import('wix-data')

    for (const coll of collectionCandidates) {
      if (posts.length > 0) break
      try {
        const results = await wixData.default
          .query(coll)
          .eq('groupId', groupId)
          .descending('_createdDate')
          .limit(20)
          .find({ suppressAuth: true })
        posts = results.items.map(normalisePost)
        steps.push(`wixData "${coll}": got ${posts.length} posts`)
        fetchError = null
      } catch (e) {
        steps.push(`wixData "${coll}" failed: ${e.message}`)
      }
    }

    // ── Internal Wix REST API candidates ─────────────────────────────────────
    // From within Velo backend, wix-fetch includes site auth automatically.
    const apiCandidates = [
      `https://www.wixapis.com/social-groups-proxy/feed/v1/feed-items?groupId=${groupId}&limit=20`,
      `https://www.wixapis.com/social-groups-proxy/feed/v2/feed-items?groupId=${groupId}&limit=20`,
      `https://www.wixapis.com/groups-feed/v1/feed-items?groupId=${groupId}&limit=20`,
      `https://www.wixapis.com/groups-feed/v2/feed-items?groupId=${groupId}&limit=20`,
      `https://www.wixapis.com/communities-groups-web/v1/groups/${groupId}/feed?limit=20`,
    ]

    if (posts.length === 0) {
      for (const apiUrl of apiCandidates) {
        if (posts.length > 0) break
        try {
          const apiRes = await veloFetch(apiUrl, {
            method:  'GET',
            headers: { 'Content-Type': 'application/json' },
          })
          steps.push(`API ${apiRes.status}: ${apiUrl.replace('https://www.wixapis.com', '')}`)
          if (apiRes.ok) {
            const apiData = await apiRes.json()
            const items = apiData.feedItems ?? apiData.items ?? apiData.posts ?? []
            posts = items.map(normaliseFeedItem)
            steps.push(`Method C: got ${posts.length} posts`)
            fetchError = null
          } else {
            const errBody = await apiRes.text().catch(() => '')
            steps.push(`Method C non-ok: ${errBody.slice(0, 120)}`)
          }
        } catch (eC) {
          steps.push(`Method C failed: ${eC.message}`)
        }
      }
    }

    // Return whatever we got — empty array is valid
    return jsonResponse({
      posts,
      groupId,
      fetchedAt: new Date().toISOString(),
      ...(fetchError ? { debug: steps } : {}),  // include steps only on error
    })

  } catch (err) {
    console.error('[insidersFeed] Unexpected error at step:', steps[steps.length - 1], err)
    return jsonResponse({
      posts:    [],
      error:    `Internal error at: ${steps[steps.length - 1] || 'startup'}`,
      detail:   err.message,
      fetchedAt: new Date().toISOString(),
    })
  }
}

// ── Normalisers ───────────────────────────────────────────────────────────────

/** For wixData collection items (Social/Posts or Groups/Posts) */
function normalisePost(item) {
  const author      = item.author || item._owner || {}
  const authorName  = author.nickname || author.name?.nick || author.name?.full
    || item.authorName || 'Community Member'
  const authorAvatar = author.picture?.url || author.photo?.url || null

  const rawContent  = item.content || item.plainContent || item.body || item.text || ''
  const plainText   = String(rawContent).replace(/<[^>]+>/g, '').trim()
  const content     = plainText.length > 280 ? plainText.slice(0, 277) + '…' : plainText

  const media       = item.media || item.mediaItems || []
  const hasMedia    = Array.isArray(media) ? media.length > 0 : !!media

  const reactions   = item.reactions || item.reactionsSummary || {}
  const likeCount   = typeof reactions === 'object'
    ? Object.values(reactions).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)
    : (item.likeCount || 0)

  const postId  = item._id || item.id
  const groupUrl = `https://www.therustic-vine.com/groups/${groupId(item)}/discussion/${postId}`

  return {
    id: postId,
    authorName,
    authorAvatar,
    content,
    createdDate:  item._createdDate ? new Date(item._createdDate).toISOString() : null,
    likeCount,
    commentCount: item.commentCount || item.totalComments || 0,
    hasMedia,
    groupUrl,
  }
}

/** For Wix internal API feed items */
function normaliseFeedItem(item) {
  const author      = item.createdBy || item.author || {}
  const authorName  = author.name || author.nickname || 'Community Member'
  const authorAvatar = author.imageUrl || author.photo?.url || null

  const rawText  = item.content?.plainText || item.plainTextContent || ''
  const content  = String(rawText).replace(/<[^>]+>/g, '').trim()
  const truncated = content.length > 280 ? content.slice(0, 277) + '…' : content

  const mediaList = item.media || item.content?.media || []
  const hasMedia  = Array.isArray(mediaList) ? mediaList.length > 0 : !!mediaList

  const reactions   = item.reactions || item.reactionsSummary || {}
  const likeCount   = Object.values(reactions)
    .reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)

  const postId  = item.id || item.feedItemId
  const gId     = item.groupId || ''
  const groupUrl = `https://www.therustic-vine.com/groups/${gId}/discussion/${postId}`

  return {
    id: postId,
    authorName,
    authorAvatar,
    content: truncated,
    createdDate:  item._createdDate ? new Date(item._createdDate).toISOString() : null,
    likeCount,
    commentCount: item.commentCount || item.totalComments || 0,
    hasMedia,
    groupUrl,
  }
}

/** Extract groupId safely from a wixData item */
function groupId(item) {
  return item.groupId || ''
}
