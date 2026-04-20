import { useState, useEffect } from 'react'

const CF_WORKER_URL = import.meta.env.VITE_CF_WORKER_URL || 'http://localhost:8787'
const CACHE_KEY     = 'rv:wix_products'
const CACHE_TTL_MS  = 5 * 60 * 1000 // 5 minutes

/**
 * Fetches all products from Wix Headless Stores.
 * Returns cached results from sessionStorage for up to 5 minutes.
 * Falls back to demo products if credentials are not configured or the API fails.
 */
export function useWixProducts({ limit = 100 } = {}) {
  const [productList, setProductList] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      // 1. Check sessionStorage cache first
      try {
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (cached) {
          const { data, ts } = JSON.parse(cached)
          if (Date.now() - ts < CACHE_TTL_MS && data?.length > 0) {
            if (!cancelled) { setProductList(data); setLoading(false) }
            return
          }
        }
      } catch { /* ignore */ }

      // 2. Fetch from CF Worker (which proxies Wix server-side)
      try {
        const res = await fetch(`${CF_WORKER_URL}/products`, {
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const items = await res.json()
        const result = Array.isArray(items) && items.length > 0 ? items : getDemoProducts()

        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, ts: Date.now() }))
        } catch { /* storage full — ignore */ }

        if (!cancelled) { setProductList(result); setLoading(false) }
      } catch (err) {
        console.error('[useWixProducts] fetch error:', err)
        if (!cancelled) {
          setError(err.message || 'Failed to load products')
          setProductList(getDemoProducts())
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [limit])

  return { products: productList, loading, error }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normaliseProduct(p) {
  const mainMedia = p.media?.mainMedia?.image
  const price     = p.priceData?.price ?? 0
  const salePrice = p.priceData?.discountedPrice !== price ? p.priceData?.discountedPrice : null
  return {
    id:          p._id,
    name:        p.name,
    slug:        p.slug,
    description: p.description ? stripHtml(p.description) : '',
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

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').trim()
}

function getDemoProducts() {
  return [
    {
      id: 'demo-1',
      name: 'Spring Wildflower Wreath Kit',
      slug: 'spring-wildflower-wreath-kit',
      description: 'Everything you need to create a stunning hand-tied wildflower wreath. Perfect for beginners!',
      price: 34.99,
      currency: 'USD',
      salePrice: null,
      image: null,
      imageAlt: 'Spring Wildflower Wreath Kit',
      inStock: true,
      ribbon: 'Bestseller',
      checkoutUrl: 'https://www.therustic-vine.com/product-page/spring-wildflower-wreath-kit',
    },
    {
      id: 'demo-2',
      name: 'Macramé Wall Hanging Kit',
      slug: 'macrame-wall-hanging-kit',
      description: 'Natural cotton rope, wooden dowel, and step-by-step video guide included.',
      price: 42.00,
      currency: 'USD',
      salePrice: 36.00,
      image: null,
      imageAlt: 'Macramé Wall Hanging Kit',
      inStock: true,
      ribbon: 'On Sale',
      checkoutUrl: '#',
    },
    {
      id: 'demo-3',
      name: 'Faith & Flowers Scripture Card Set',
      slug: 'faith-flowers-scripture-cards',
      description: 'Hand-lettered scripture cards with pressed flower accents. Set of 12.',
      price: 18.00,
      currency: 'USD',
      salePrice: null,
      image: null,
      imageAlt: 'Scripture Card Set',
      inStock: true,
      ribbon: 'New',
      checkoutUrl: '#',
    },
    {
      id: 'demo-4',
      name: 'Candle Making Starter Kit',
      slug: 'candle-making-starter-kit',
      description: 'Soy wax, fragrance blends, wicks, and tins. Craft your own home-scented candles.',
      price: 28.50,
      currency: 'USD',
      salePrice: null,
      image: null,
      imageAlt: 'Candle Making Kit',
      inStock: false,
      ribbon: null,
      checkoutUrl: '#',
    },
    {
      id: 'demo-5',
      name: 'Pressed Botanical Art Kit',
      slug: 'pressed-botanical-art-kit',
      description: 'Create frameable art with real pressed flowers and foliage. Frames included.',
      price: 39.99,
      currency: 'USD',
      salePrice: null,
      image: null,
      imageAlt: 'Pressed Botanical Art Kit',
      inStock: true,
      ribbon: null,
      checkoutUrl: '#',
    },
    {
      id: 'demo-6',
      name: 'VIP Insider Monthly Box',
      slug: 'vip-insider-monthly-box',
      description: 'Monthly surprise kit delivered to your door — exclusive to Rustic Vine Insiders.',
      price: 24.99,
      currency: 'USD',
      salePrice: null,
      image: null,
      imageAlt: 'VIP Insider Monthly Box',
      inStock: true,
      ribbon: 'Insider Exclusive',
      checkoutUrl: '#',
    },
  ]
}
