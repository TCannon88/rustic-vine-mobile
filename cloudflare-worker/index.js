/**
 * The Rustic Vine — Cloudflare Worker
 *
 * Endpoints:
 *   GET  /event             — next scheduled live event
 *   GET  /featured-product  — current featured product ID (for live stream)
 *   GET  /products          — proxied Wix Headless product catalog (avoids CORS)
 *   GET  /blog-posts        — proxied Wix Blog posts with 15-min KV cache
 *   GET  /insider-feed      — Insiders group feed (served from KV; posts pushed by Velo/Automations)
 *   POST /insider-post      — webhook: Velo events / Wix Automations push a post into KV
 *   POST /chat-token        — issues a signed Ably TokenRequest after verifying Wix member identity
 *   POST /subscribe         — register a Web Push subscription
 *   POST /notify            — broadcast a push notification to all subscribers
 *
 * KV bindings (set in wrangler.toml):
 *   RUSTIC_VINE_KV
 *
 * Worker secrets (set via `wrangler secret put`):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
 *   ABLY_ROOT_KEY
 *   MUX_TOKEN_ID, MUX_TOKEN_SECRET
 *   RV_FEED_SECRET      — shared secret for /insider-feed auth header from PWA
 *   NOTIFY_SECRET       — shared secret for /insider-post Velo webhook
 */

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://app.therustic-vine.com',
  'http://localhost:5173',
  'http://localhost:4173', // vite preview
])

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://app.therustic-vine.com'
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Notify-Secret, X-RV-Secret',
    'Vary': 'Origin',
  }
}

function json(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
  })
}

function err(msg, status = 400, request) {
  return json({ error: msg }, status, request)
}

// ── Router ────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url)
    const method = request.method.toUpperCase()

    // Request-scoped helpers — bind CORS to this specific request's origin
    // so every response automatically carries the right Allow-Origin header.
    const j = (data, status = 200) => json(data, status, request)
    const e = (msg,  status = 400) => err(msg,  status, request)

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: getCorsHeaders(request) })
    }

    // ── GET /event ────────────────────────────────────────────────────────────
    if (method === 'GET' && url.pathname === '/event') {
      const raw = await env.RUSTIC_VINE_KV.get('next_event')
      if (!raw) {
        return j({
          title:       'Next Craft-Along TBD',
          description: 'Check back soon for the next live event!',
          date:        null,
          isLive:      false,
          playbackId:  null,
        })
      }
      return j(JSON.parse(raw))
    }

    // ── GET /featured-product ─────────────────────────────────────────────────
    if (method === 'GET' && url.pathname === '/featured-product') {
      const raw = await env.RUSTIC_VINE_KV.get('featured_product')
      if (!raw) return j(null)
      return j(JSON.parse(raw))
    }

    // ── GET /products ─────────────────────────────────────────────────────────
    // Server-side proxy for Wix Headless Stores API — avoids CORS issues in the browser.
    // Caches results in KV for 5 minutes to reduce Wix API quota usage.
    if (method === 'GET' && url.pathname === '/products') {
      // Try KV cache first
      const cached = await env.RUSTIC_VINE_KV.get('products_cache')
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < 5 * 60 * 1000) {
          return j(data)
        }
      }

      // Fetch from Wix Headless REST API
      const WIX_SITE_ID = env.WIX_SITE_ID
      const WIX_API_KEY = env.WIX_API_KEY
      if (!WIX_SITE_ID || !WIX_API_KEY) {
        return j([]) // not configured
      }

      try {
        const wixRes = await fetch(
          `https://www.wixapis.com/stores/v1/products/query`,
          {
            method: 'POST',
            headers: {
              'Authorization': WIX_API_KEY,
              'wix-site-id':   WIX_SITE_ID,
              'Content-Type':  'application/json',
            },
            body: JSON.stringify({ query: { paging: { limit: 100 } } }),
          }
        )

        if (!wixRes.ok) {
          const errText = await wixRes.text().catch(() => '')
          console.error(`Wix products error ${wixRes.status}: ${errText}`)
          return j([])
        }

        const wixData = await wixRes.json()
        const products = (wixData.products ?? []).map(normaliseWixProduct)

        // Cache in KV
        await env.RUSTIC_VINE_KV.put(
          'products_cache',
          JSON.stringify({ data: products, ts: Date.now() }),
          { expirationTtl: 300 }
        )

        return j(products)
      } catch (e) {
        console.error('Wix proxy error:', e)
        return j([])
      }
    }

    // ── GET /blog-posts ───────────────────────────────────────────────────────
    // Server-side proxy for Wix Blog API — avoids CORS, caches for 15 minutes.
    if (method === 'GET' && url.pathname === '/blog-posts') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '6', 10), 20)

      // Try KV cache first
      const cacheKey = `blog_posts_${limit}`
      const cached = await env.RUSTIC_VINE_KV.get(cacheKey)
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < 15 * 60 * 1000) {
          return j(data)
        }
      }

      const WIX_SITE_ID = env.WIX_SITE_ID
      const WIX_API_KEY = env.WIX_API_KEY
      if (!WIX_SITE_ID || !WIX_API_KEY) return j([])

      try {
        const wixRes = await fetch(
          `https://www.wixapis.com/blog/v3/posts?paging.limit=${limit}&fieldsets=CONTENT_TEXT&sort.fieldName=publishedDate&sort.order=DESC`,
          {
            headers: {
              'Authorization': WIX_API_KEY,
              'wix-site-id':   WIX_SITE_ID,
            },
          }
        )

        if (!wixRes.ok) {
          const errText = await wixRes.text().catch(() => '')
          console.error(`Wix blog error ${wixRes.status}: ${errText}`)
          return j([])
        }

        const wixData = await wixRes.json()
        const posts = (wixData.posts ?? []).map(normaliseWixPost)

        await env.RUSTIC_VINE_KV.put(
          cacheKey,
          JSON.stringify({ data: posts, ts: Date.now() }),
          { expirationTtl: 900 }
        )

        return j(posts)
      } catch (e) {
        console.error('Blog proxy error:', e)
        return j([])
      }
    }

    // ── GET /group-feed ───────────────────────────────────────────────────────
    // Server-side proxy for Wix Groups Feed API.
    // Returns the latest posts from the Insiders group, cached 5 minutes.
    // Requires WIX_SITE_ID, WIX_API_KEY, and WIX_GROUP_ID worker secrets.
    if (method === 'GET' && url.pathname === '/group-feed') {
      const limit    = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50)
      const cacheKey = `group_feed_${limit}`

      // KV cache check
      const cached = await env.RUSTIC_VINE_KV.get(cacheKey)
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < 5 * 60 * 1000) return j(data)
      }

      const WIX_SITE_ID = env.WIX_SITE_ID
      const WIX_API_KEY = env.WIX_API_KEY
      const WIX_GROUP_ID = env.WIX_GROUP_ID
      if (!WIX_SITE_ID || !WIX_API_KEY || !WIX_GROUP_ID) {
        return j({ posts: [], error: 'Worker not configured for group feed' })
      }

      try {
        // Wix Groups Feed v1 — list feed items for a group
        const wixRes = await fetch(
          `https://www.wixapis.com/groups/v1/groups/${WIX_GROUP_ID}/feed`,
          {
            method: 'GET',
            headers: {
              'Authorization': WIX_API_KEY,
              'wix-site-id':   WIX_SITE_ID,
              'Content-Type':  'application/json',
            },
          }
        )

        if (!wixRes.ok) {
          const errText = await wixRes.text().catch(() => '')
          console.error(`Wix group feed error ${wixRes.status}: ${errText}`)
          return j({ posts: [], error: `Wix API ${wixRes.status}` })
        }

        const wixData = await wixRes.json()

        // The feed response contains 'feedItems' or 'items'
        const rawItems = wixData.feedItems ?? wixData.items ?? []
        const posts = rawItems.slice(0, limit).map(normaliseGroupFeedItem)

        const payload = {
          posts,
          groupId:   WIX_GROUP_ID,
          fetchedAt: new Date().toISOString(),
        }

        await env.RUSTIC_VINE_KV.put(
          cacheKey,
          JSON.stringify({ data: payload, ts: Date.now() }),
          { expirationTtl: 300 }
        )

        return j(payload)
      } catch (e) {
        console.error('Group feed proxy error:', e)
        return j({ posts: [], error: 'Fetch failed' })
      }
    }

    // ── GET /insider-feed ─────────────────────────────────────────────────────
    // Serves the Insiders group feed from KV.
    // Posts are written into KV by POST /insider-post (Velo events / Automations).
    // Requires Authorization header so anonymous callers can't harvest member data.
    if (method === 'GET' && url.pathname === '/insider-feed') {
      const authHeader = request.headers.get('Authorization') || ''
      if (!authHeader) {
        return e('Unauthorized', 401)
      }

      const raw = await env.RUSTIC_VINE_KV.get('insider_feed_posts')
      const posts = raw ? JSON.parse(raw) : []

      return j({
        posts,
        fetchedAt: new Date().toISOString(),
        source:    'kv',
      })
    }

    // ── POST /insider-post ────────────────────────────────────────────────────
    // Webhook receiver — Wix Velo events / Automations call this when a group
    // post is created. Validates X-Notify-Secret, prepends the post to the KV
    // feed array (max 50 posts kept).
    if (method === 'POST' && url.pathname === '/insider-post') {
      const notifySecret = env.NOTIFY_SECRET || ''

      // ── DIAGNOSTIC: log ALL headers Wix sends ─────────────────────────────
      const allHeaders = {}
      for (const [k, v] of request.headers.entries()) allHeaders[k] = v
      console.log('[insider-post] ALL HEADERS:', JSON.stringify(allHeaders))

      // Parse body — try all formats, capture raw text first
      let post = {}
      let rawBodyText = ''
      let contentType = ''
      try {
        contentType = request.headers.get('Content-Type') || ''
        console.log('[insider-post] Content-Type:', contentType)

        // Clone request to read body twice
        const bodyClone = request.clone()
        rawBodyText = await bodyClone.text()
        console.log('[insider-post] RAW BODY (first 500):', rawBodyText.slice(0, 500))

        if (contentType.includes('application/json')) {
          try { post = JSON.parse(rawBodyText) } catch { post = { raw: rawBodyText } }
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          const params = new URLSearchParams(rawBodyText)
          for (const [k, v] of params.entries()) post[k] = v
        } else if (contentType.includes('multipart/form-data')) {
          const form = await request.formData()
          for (const [k, v] of form.entries()) post[k] = v
        } else {
          // Unknown content type — try JSON parse first
          try { post = JSON.parse(rawBodyText) } catch { post = { raw: rawBodyText } }
        }

        console.log('[insider-post] Parsed keys:', Object.keys(post).join(', '))
        console.log('[insider-post] Full post object:', JSON.stringify(post).slice(0, 500))

        // Wix Automations sometimes wraps params in a top-level key
        for (const wrapKey of ['data', 'payload', 'body', 'params']) {
          if (post[wrapKey] && typeof post[wrapKey] === 'object' && Object.keys(post).length === 1) {
            post = post[wrapKey]
            console.log(`[insider-post] Unwrapped '${wrapKey}' key. New keys:`, Object.keys(post).join(', '))
            break
          }
        }

      } catch (e) {
        console.error('[insider-post] Parse error:', e.message)
        // Still return success so Wix doesn't mark the automation as failed
        return j({ success: true, diagnostic: true, error: e.message })
      }

      // Validate secret — accept from header OR body param `_secret`
      const headerSecret = request.headers.get('X-Notify-Secret') || ''
      const bodySecret   = (post._secret || post.secret || post._Secret || '').trim()
      const incoming     = (headerSecret || bodySecret)
      const secretMatch  = notifySecret && incoming === notifySecret
      console.log('[insider-post] secret match:', secretMatch,
        '| incoming len:', incoming.length, '| expected len:', notifySecret.length)

      if (!secretMatch) {
        return e('Unauthorized', 401)
      }

      // Remove the secret from the post object so it's not stored in KV
      delete post._secret

      // Normalize keys — Wix Automations lowercases all param names
      if (post.authorname  && !post.authorName)  { post.authorName  = post.authorname;  delete post.authorname  }
      if (post.groupurl    && !post.groupUrl)     { post.groupUrl    = post.groupurl;    delete post.groupurl    }
      if (post.hasMedia    === undefined && post.hasmedia !== undefined) {
        post.hasMedia = post.hasmedia; delete post.hasmedia
      }

      // If authorName is an email address, replace with a friendly fallback
      if (post.authorName && post.authorName.includes('@')) {
        post.authorName = post.authorName.split('@')[0]
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
      }

      // Stamp with server time if missing
      if (!post.createdDate) post.createdDate = new Date().toISOString()
      if (!post.id)          post.id = `${Date.now()}`

      // Load existing posts, prepend new one, keep newest 50
      const existing = await env.RUSTIC_VINE_KV.get('insider_feed_posts')
      const posts    = existing ? JSON.parse(existing) : []
      posts.unshift(post)
      const trimmed  = posts.slice(0, 50)

      await env.RUSTIC_VINE_KV.put('insider_feed_posts', JSON.stringify(trimmed))

      // Also clear any cached feed response so the next GET is fresh
      await env.RUSTIC_VINE_KV.delete('insider_feed_cache')

      return j({ success: true, total: trimmed.length })
    }

    // ── POST /chat-token ──────────────────────────────────────────────────────
    // Issues a short-lived Ably TokenRequest for the live chat channel.
    // Verifies the caller's Wix access token with the Wix Members API (Option B)
    // before minting the token so clientId cannot be spoofed by the browser.
    // Guest fallback is issued if no/invalid accessToken is supplied.
    if (method === 'POST' && url.pathname === '/chat-token') {
      const ABLY_ROOT_KEY = env.ABLY_ROOT_KEY || ''
      const WIX_SITE_ID   = env.WIX_SITE_ID   || ''

      if (!ABLY_ROOT_KEY) {
        return e('Chat not configured', 503)
      }

      // Parse request body
      let body = {}
      try { body = await request.json() } catch { /* empty body is fine */ }
      const { accessToken } = body

      // ── Verify Wix member identity ────────────────────────────────────────
      let memberId      = null
      let memberName    = null
      let memberAvatar  = null

      if (accessToken && WIX_SITE_ID) {
        try {
          const wixRes = await fetch(
            'https://www.wixapis.com/members/v1/members/my?fieldsets=FULL',
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'wix-site-id':   WIX_SITE_ID,
              },
              signal: AbortSignal.timeout(5000),
            }
          )

          if (wixRes.ok) {
            const { member: m } = await wixRes.json()
            memberId     = m.id
            const nick   = m.profile?.nickname || ''
            const first  = m.contact?.firstName || ''
            const last   = m.contact?.lastName  || ''
            const full   = `${first} ${last}`.trim()
            const email  = (m.loginEmail || '').split('@')[0]
              .replace(/[._-]/g, ' ')
              .replace(/\b\w/g, c => c.toUpperCase())
            memberName   = nick || full || email || 'Crafter'
            memberAvatar = m.profile?.photo?.url ?? null
          } else {
            console.warn('[chat-token] Wix member verify failed:', wixRes.status)
          }
        } catch (e) {
          console.error('[chat-token] Wix verify error:', e.message)
        }
      }

      // ── Guest fallback ────────────────────────────────────────────────────
      if (!memberId) {
        memberId    = `guest-${crypto.randomUUID()}`
        memberName  = `Crafter#${Math.floor(1000 + Math.random() * 9000)}`
        memberAvatar = null
      }

      // ── Build signed Ably TokenRequest ────────────────────────────────────
      // Ably token request spec:
      //   https://ably.com/docs/auth/token#token-request-format
      // String to sign (each field terminated by newline):
      //   keyName \n ttl \n capability \n clientId \n timestamp \n nonce \n
      const [keyName, keySecret] = ABLY_ROOT_KEY.split(':')
      const capability = JSON.stringify({
        'rustic-vine:live-chat': ['publish', 'subscribe', 'presence'],
      })
      const ttl       = 3600 * 1000          // 1 hour in ms
      const timestamp = Date.now()
      const nonce     = crypto.randomUUID().replace(/-/g, '')

      const toSign = [keyName, ttl, capability, memberId, timestamp, nonce, ''].join('\n')

      const enc       = new TextEncoder()
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        enc.encode(keySecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(toSign))
      const mac    = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))

      const tokenRequest = { keyName, ttl, capability, clientId: memberId, timestamp, nonce, mac }

      return j({
        tokenRequest,
        member: { id: memberId, name: memberName, avatarUrl: memberAvatar },
      })
    }

    // ── POST /subscribe ───────────────────────────────────────────────────────
    if (method === 'POST' && url.pathname === '/subscribe') {
      let sub
      try {
        sub = await request.json()
        if (!sub?.endpoint) throw new Error('Missing endpoint')
      } catch {
        return e('Invalid subscription object')
      }

      // Load existing subscribers
      const existingRaw = await env.RUSTIC_VINE_KV.get('push_subscribers')
      const subscribers = existingRaw ? JSON.parse(existingRaw) : []

      // Deduplicate by endpoint
      const already = subscribers.some(s => s.endpoint === sub.endpoint)
      if (!already) {
        subscribers.push(sub)
        await env.RUSTIC_VINE_KV.put('push_subscribers', JSON.stringify(subscribers))
      }

      return j({ success: true, count: subscribers.length })
    }

    // ── POST /notify ──────────────────────────────────────────────────────────
    if (method === 'POST' && url.pathname === '/notify') {
      // Require a simple shared secret for admin protection
      const auth = request.headers.get('Authorization') || ''
      const adminKey = env.NOTIFY_ADMIN_KEY || ''
      if (adminKey && auth !== `Bearer ${adminKey}`) {
        return e('Unauthorized', 401)
      }

      let payload
      try {
        payload = await request.json()
        if (!payload?.title) throw new Error('title is required')
      } catch (e) {
        return e(e.message)
      }

      const subsRaw = await env.RUSTIC_VINE_KV.get('push_subscribers')
      if (!subsRaw) return j({ sent: 0, message: 'No subscribers yet' })

      const subscribers = JSON.parse(subsRaw)

      // Send push via Web Push protocol
      const results = await Promise.allSettled(
        subscribers.map(sub => sendWebPush(sub, payload, env))
      )

      const sent   = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      // Clean up expired subscriptions
      const valid = subscribers.filter((_, i) => results[i].status === 'fulfilled')
      if (failed > 0) {
        await env.RUSTIC_VINE_KV.put('push_subscribers', JSON.stringify(valid))
      }

      return j({ sent, failed, total: subscribers.length })
    }

    // ── 404 ───────────────────────────────────────────────────────────────────
    return e('Not found', 404)
  },
}

// ── Web Push helper ───────────────────────────────────────────────────────────
async function sendWebPush(subscription, payload, env) {
  const { endpoint, keys } = subscription
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error('Incomplete subscription')
  }

  // Build VAPID JWT
  const vapidJwt = await buildVapidJwt(endpoint, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)

  const body = JSON.stringify({
    title: payload.title,
    body:  payload.body || '',
    url:   payload.url || '/',
    type:  payload.type || 'general',
  })

  // Encrypt payload (simplified — real implementation uses web-push library or CF workers-do-it approach)
  // For now we send unencrypted for development; encrypt with ECDH in production
  const response = await fetch(endpoint, {
    method:  'POST',
    headers: {
      'Authorization': `vapid t=${vapidJwt},k=${env.VAPID_PUBLIC_KEY}`,
      'Content-Type':  'application/json',
      'TTL':           '86400',
    },
    body,
  })

  if (!response.ok && response.status !== 201) {
    const text = await response.text().catch(() => '')
    throw new Error(`Push failed ${response.status}: ${text}`)
  }
}

async function buildVapidJwt(endpoint, publicKey, privateKeyB64) {
  const origin  = new URL(endpoint).origin
  const now     = Math.floor(Date.now() / 1000)
  const exp     = now + 12 * 3600

  const header  = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const claims  = btoa(JSON.stringify({ aud: origin, exp, sub: 'mailto:hello@therustic-vine.com' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const toSign  = `${header}.${claims}`

  // Import private key
  const pkBytes = Uint8Array.from(atob(privateKeyB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', pkBytes.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  )

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(toSign)
  )

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${toSign}.${sigB64}`
}

// ── Wix product normaliser ────────────────────────────────────────────────────
function normaliseWixProduct(p) {
  const mainMedia = p.media?.mainMedia?.image
  const price     = p.priceData?.price ?? 0
  const discounted = p.priceData?.discountedPrice
  const salePrice = (discounted && discounted < price) ? discounted : null
  return {
    id:          p.id,
    name:        p.name,
    slug:        p.slug,
    description: p.description ? p.description.replace(/<[^>]+>/g, '').trim() : '',
    price,
    currency:    p.priceData?.currency || 'USD',
    salePrice,
    image:       mainMedia?.url || null,
    imageAlt:    mainMedia?.altText || p.name,
    inStock:     p.stock?.inStock ?? true,
    ribbon:      p.ribbon || null,
    checkoutUrl: `https://www.therustic-vine.com/product-page/${p.slug}`,
  }
}

// ── Wix Blog post normaliser ──────────────────────────────────────────────────
function normaliseWixPost(p) {
  // Cover image: try media object then first rich-content image
  const coverImage = p.media?.wixMedia?.image?.url
    ?? p.heroImage?.url
    ?? null

  // Excerpt: prefer explicit excerpt, fall back to plain-text snippet
  const excerpt = p.excerpt
    ?? (p.contentText ? p.contentText.replace(/<[^>]+>/g, '').slice(0, 160).trim() + '…' : '')

  return {
    id:            p.id,
    title:         p.title,
    slug:          p.slug,
    excerpt,
    coverImage,
    publishedDate: p.firstPublishedDate ?? p.publishedDate ?? null,
    url:           `https://www.therustic-vine.com/post/${p.slug}`,
  }
}

// ── Wix Group Feed item normaliser ────────────────────────────────────────────
// Maps a raw Wix Groups Feed item to the shape consumed by GroupFeed.jsx
function normaliseGroupFeedItem(item) {
  // Author info — may be under item.createdBy or item.author
  const author = item.createdBy ?? item.author ?? {}
  const authorName  = author.name ?? author.nickname ?? 'Community Member'
  const authorPhoto = author.imageUrl ?? author.photo?.url ?? null

  // Content — may be plainText or rich content
  const rawText  = item.content?.plainText ?? item.plainTextContent ?? ''
  const content  = rawText.replace(/<[^>]+>/g, '').trim()

  // Media — first image from the post
  const mediaList = item.media ?? item.content?.media ?? []
  const firstImg  = Array.isArray(mediaList) ? mediaList[0] : null
  const mediaUrl  = firstImg?.image?.url
    ?? firstImg?.wixMedia?.image?.url
    ?? firstImg?.url
    ?? null

  // Reactions / comments
  const reactions = item.reactions ?? item.reactionsSummary ?? {}
  const totalReactions = Object.values(reactions).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)
  const commentCount   = item.commentCount ?? item.totalComments ?? 0

  // Deep-link to the post in the Wix group
  const postId   = item.id ?? item.feedItemId
  const groupUrl = `https://www.therustic-vine.com/groups/${item.groupId ?? ''}/discussion/${postId ?? ''}`

  return {
    id:           postId,
    authorName,
    authorPhoto,
    content,
    mediaUrl,
    totalReactions,
    commentCount,
    createdDate:  item._createdDate ?? item.createdDate ?? null,
    groupUrl,
  }
}
