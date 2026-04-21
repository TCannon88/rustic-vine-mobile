/**
 * Wix Velo HTTP Functions — The Rustic Vine
 *
 * File location in Wix editor:  backend/http-functions.js
 *
 * Active endpoints:
 *   (none currently — group feed is now event-driven via groups-events.js)
 *
 * Reserved for future use:
 *   POST /_functions/adminPost  — manually inject a post into the CF Worker KV
 *                                  (useful for testing without curl)
 */

import { ok, forbidden } from 'wix-http-functions';
import { getSecret } from 'wix-secrets-backend';
import { fetch as veloFetch } from 'wix-fetch';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-RV-Secret',
    'Content-Type': 'application/json',
  }
}

function jsonResponse(data, status = 200) {
  const body = JSON.stringify(data)
  if (status === 401 || status === 403) return forbidden({ body, headers: corsHeaders() })
  return ok({ body, headers: corsHeaders() })
}

export function options_adminPost(_req) {
  return ok({ headers: corsHeaders() })
}

/**
 * POST /_functions/adminPost
 *
 * Manually push a post into the CF Worker KV feed — useful for testing
 * without needing curl. Protected by the same shared secret.
 *
 * Body: { authorName, content, groupUrl? }
 */
export async function post_adminPost(request) {
  try {
    const secret   = await getSecret('PWA_FEED_SECRET')
    const incoming = (request.headers && (
      request.headers['X-RV-Secret'] || request.headers['x-rv-secret']
    )) || ''

    if (!secret || incoming.trim() !== secret.trim()) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const workerUrl    = await getSecret('CF_WORKER_URL')
    const notifySecret = await getSecret('NOTIFY_SECRET')

    let body
    try { body = JSON.parse(request.body) } catch { body = {} }

    const post = {
      id:          `admin-${Date.now()}`,
      authorName:  body.authorName  || 'Lisa',
      authorAvatar: null,
      content:     body.content     || '',
      createdDate: new Date().toISOString(),
      likeCount:   0,
      commentCount: 0,
      hasMedia:    false,
      groupUrl:    body.groupUrl || 'https://www.therustic-vine.com/groups',
    }

    const res = await veloFetch(`${workerUrl}/insider-post`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Notify-Secret': notifySecret,
      },
      body: JSON.stringify(post),
    })

    const result = await res.json()
    return jsonResponse({ success: res.ok, workerStatus: res.status, ...result })
  } catch (err) {
    return jsonResponse({ error: err.message })
  }
}
