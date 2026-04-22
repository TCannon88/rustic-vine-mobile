/**
 * Wix Velo HTTP Functions — The Rustic Vine
 *
 * File location in Wix editor:  backend/http-functions.js
 *
 * Active endpoints:
 *   GET  /_functions/authCallback  — OAuth relay: redirects back to PWA with code+state
 *   POST /_functions/adminPost     — manually inject a post into the CF Worker KV
 *                                    (useful for testing without curl)
 */

import { ok, forbidden, response } from 'wix-http-functions';
import { getSecret } from 'wix-secrets-backend';
import { fetch as veloFetch } from 'wix-fetch';

// PWA origin — update this if the production domain changes
const PWA_ORIGIN = 'https://rustic-vine-mobile.tomcannon92.workers.dev'

/**
 * GET /_functions/authCallback
 *
 * OAuth relay: Wix redirects here after login (because workers.dev is not an
 * accepted Wix redirect domain). This function immediately 302-redirects the
 * user back to the PWA's /auth/callback with the same code+state params so
 * the PWA can complete the token exchange against its own localStorage state.
 */
export function get_authCallback(request) {
  const code  = (request.query && request.query.code)  || ''
  const state = (request.query && request.query.state) || ''
  const error = (request.query && request.query.error) || ''

  let dest = `${PWA_ORIGIN}/auth/callback`
  const params = []
  if (code)  params.push(`code=${encodeURIComponent(code)}`)
  if (state) params.push(`state=${encodeURIComponent(state)}`)
  if (error) params.push(`error=${encodeURIComponent(error)}`)
  if (params.length) dest += '?' + params.join('&')

  return response({ status: 302, headers: { Location: dest }, body: '' })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  'https://app.therustic-vine.com',
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
