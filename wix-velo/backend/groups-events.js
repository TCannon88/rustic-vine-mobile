/**
 * Wix Velo Backend Events — Insiders Group Post Handler
 *
 * File location in Wix editor:  backend/groups-events.js
 *
 * This file listens for Wix Groups post-creation events fired by the
 * Wix platform and immediately POSTs the post data to the Cloudflare
 * Worker, which stores it in KV for the PWA to read.
 *
 * HOW TO INSTALL:
 *   1. In Wix Editor → Code panel → Backend
 *   2. Create a new file named: groups-events.js
 *   3. Paste this entire file
 *   4. Add CF_WORKER_URL and NOTIFY_SECRET to Wix Secrets Manager:
 *        CF_WORKER_URL  = https://rustic-vine-worker.tomcannon92.workers.dev
 *        NOTIFY_SECRET  = rv-feed-2026-aBcXyZ9
 *   5. Publish your site
 *
 * NOTES:
 *   - Wix fires these events synchronously when a group post is created.
 *   - The fetch call is fire-and-forget — we don't await it so we don't
 *     block the event handler and risk Wix timing it out.
 *   - Multiple export names are provided because Wix has changed the
 *     event naming convention across platform versions. Only the one
 *     matching your site's Wix version will fire — the rest are no-ops.
 */

import { getSecret } from 'wix-secrets-backend';
import { fetch as veloFetch } from 'wix-fetch';

// ── Shared handler ─────────────────────────────────────────────────────────────
async function handleGroupPost(event) {
  console.log('[groups-events] Received event:', JSON.stringify(event).slice(0, 200))

  try {
    const workerUrl  = await getSecret('CF_WORKER_URL')
    const secret     = await getSecret('NOTIFY_SECRET')

    if (!workerUrl || !secret) {
      console.error('[groups-events] Missing secrets CF_WORKER_URL or NOTIFY_SECRET')
      return
    }

    // Normalise the event into our post shape — field names vary by Wix version
    const post = normaliseEvent(event)

    // Fire-and-forget POST to CF Worker
    veloFetch(`${workerUrl}/insider-post`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Notify-Secret': secret,
      },
      body: JSON.stringify(post),
    }).then(res => {
      console.log(`[groups-events] Worker responded: ${res.status}`)
    }).catch(err => {
      console.error('[groups-events] Worker fetch failed:', err.message)
    })
  } catch (err) {
    console.error('[groups-events] Unexpected error:', err.message)
  }
}

function normaliseEvent(event) {
  // Wix sends group post events with varying field structures.
  // We try to extract the fields we need regardless of version.
  const post    = event.post || event.entity || event.data || event
  const author  = post.createdBy || post.author || event.triggeredByMember || {}

  const authorName   = author.nickname || author.name?.nick || author.name?.full
    || author.memberName || 'Community Member'
  const authorAvatar = author.picture?.url || author.photo?.url || null

  const rawContent = post.content || post.plainContent || post.body || post.text || ''
  const content    = String(rawContent).replace(/<[^>]+>/g, '').trim()
  const truncated  = content.length > 280 ? content.slice(0, 277) + '…' : content

  const media    = post.media || post.mediaItems || post.attachment || []
  const hasMedia = Array.isArray(media) ? media.length > 0 : !!media

  const postId  = post._id || post.id || post.postId
  const groupId = post.groupId || event.groupId || ''
  const groupUrl = `https://www.therustic-vine.com/groups/${groupId}/discussion/${postId}`

  return {
    id:           postId,
    authorName,
    authorAvatar,
    content:      truncated,
    createdDate:  new Date().toISOString(),
    likeCount:    0,
    commentCount: 0,
    hasMedia,
    groupUrl,
    groupId,
  }
}

// ── Event handler exports ──────────────────────────────────────────────────────
// Wix has used different naming conventions across platform versions.
// We export all known variants — only the matching one will be called.

// Current Wix Groups v2 SDK naming
export function wixGroupsV2_onPostCreated(event) {
  return handleGroupPost(event)
}

// Legacy naming
export function wixGroups_onPostCreated(event) {
  return handleGroupPost(event)
}

// Possible community/social naming
export function wixCommunities_onPostCreated(event) {
  return handleGroupPost(event)
}

export function wixSocialGroups_onPostCreated(event) {
  return handleGroupPost(event)
}

// Generic fallback (some Wix versions use this)
export function onGroupPostCreated(event) {
  return handleGroupPost(event)
}
