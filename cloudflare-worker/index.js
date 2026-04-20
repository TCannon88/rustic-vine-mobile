/**
 * The Rustic Vine — Cloudflare Worker
 *
 * Endpoints:
 *   GET  /event             — next scheduled live event
 *   GET  /featured-product  — current featured product ID (for live stream)
 *   GET  /products          — proxied Wix Headless product catalog (avoids CORS)
 *   GET  /blog-posts        — proxied Wix Blog posts with 15-min KV cache
 *   POST /subscribe         — register a Web Push subscription
 *   POST /notify            — broadcast a push notification to all subscribers
 *
 * KV bindings (set in wrangler.toml):
 *   RUSTIC_VINE_KV
 *
 * Worker secrets (set via `wrangler secret put`):
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   ABLY_ROOT_KEY
 *   MUX_TOKEN_ID
 *   MUX_TOKEN_SECRET
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function err(msg, status = 400) {
  return json({ error: msg }, status)
}

// ── Router ────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url)
    const method = request.method.toUpperCase()

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    // ── GET /event ────────────────────────────────────────────────────────────
    if (method === 'GET' && url.pathname === '/event') {
      const raw = await env.RUSTIC_VINE_KV.get('next_event')
      if (!raw) {
        return json({
          title:       'Next Craft-Along TBD',
          description: 'Check back soon for the next live event!',
          date:        null,
          isLive:      false,
          playbackId:  null,
        })
      }
      return json(JSON.parse(raw))
    }

    // ── GET /featured-product ─────────────────────────────────────────────────
    if (method === 'GET' && url.pathname === '/featured-product') {
      const raw = await env.RUSTIC_VINE_KV.get('featured_product')
      if (!raw) return json(null)
      return json(JSON.parse(raw))
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
          return json(data)
        }
      }

      // Fetch from Wix Headless REST API
      const WIX_SITE_ID = env.WIX_SITE_ID
      const WIX_API_KEY = env.WIX_API_KEY
      if (!WIX_SITE_ID || !WIX_API_KEY) {
        return json([]) // not configured
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
          return json([])
        }

        const wixData = await wixRes.json()
        const products = (wixData.products ?? []).map(normaliseWixProduct)

        // Cache in KV
        await env.RUSTIC_VINE_KV.put(
          'products_cache',
          JSON.stringify({ data: products, ts: Date.now() }),
          { expirationTtl: 300 }
        )

        return json(products)
      } catch (e) {
        console.error('Wix proxy error:', e)
        return json([])
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
          return json(data)
        }
      }

      const WIX_SITE_ID = env.WIX_SITE_ID
      const WIX_API_KEY = env.WIX_API_KEY
      if (!WIX_SITE_ID || !WIX_API_KEY) return json([])

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
          return json([])
        }

        const wixData = await wixRes.json()
        const posts = (wixData.posts ?? []).map(normaliseWixPost)

        await env.RUSTIC_VINE_KV.put(
          cacheKey,
          JSON.stringify({ data: posts, ts: Date.now() }),
          { expirationTtl: 900 }
        )

        return json(posts)
      } catch (e) {
        console.error('Blog proxy error:', e)
        return json([])
      }
    }

    // ── POST /subscribe ───────────────────────────────────────────────────────
    if (method === 'POST' && url.pathname === '/subscribe') {
      let sub
      try {
        sub = await request.json()
        if (!sub?.endpoint) throw new Error('Missing endpoint')
      } catch {
        return err('Invalid subscription object')
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

      return json({ success: true, count: subscribers.length })
    }

    // ── POST /notify ──────────────────────────────────────────────────────────
    if (method === 'POST' && url.pathname === '/notify') {
      // Require a simple shared secret for admin protection
      const auth = request.headers.get('Authorization') || ''
      const adminKey = env.NOTIFY_ADMIN_KEY || ''
      if (adminKey && auth !== `Bearer ${adminKey}`) {
        return err('Unauthorized', 401)
      }

      let payload
      try {
        payload = await request.json()
        if (!payload?.title) throw new Error('title is required')
      } catch (e) {
        return err(e.message)
      }

      const subsRaw = await env.RUSTIC_VINE_KV.get('push_subscribers')
      if (!subsRaw) return json({ sent: 0, message: 'No subscribers yet' })

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

      return json({ sent, failed, total: subscribers.length })
    }

    // ── 404 ───────────────────────────────────────────────────────────────────
    return err('Not found', 404)
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
