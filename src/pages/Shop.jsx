import { useState, useMemo } from 'react'
import { useWixProducts } from '../hooks/useWixProducts.js'
import ProductCard from '../components/ProductCard.jsx'
import { ShoppingCartIcon, XIcon } from '../components/Icons.jsx'

// ── Cart Helpers ──────────────────────────────────────────────────────────────
const CART_KEY = 'rv:cart'

function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') } catch { return [] }
}

function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items))
}

// ── Cart Drawer ───────────────────────────────────────────────────────────────
function CartDrawer({ cart, onRemove, onClose, onCheckout }) {
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0)

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="w-80 max-w-full bg-white flex flex-col shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-4 py-4 border-b border-stone-100">
          <h2 className="font-display font-semibold text-burgundy-800 text-lg">Your Cart</h2>
          <button id="cart-close-btn" onClick={onClose} aria-label="Close cart">
            <XIcon className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <p className="text-center text-stone-400 italic py-8 text-sm">Your cart is empty 🌿</p>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex gap-3 items-center">
                <div className="w-14 h-14 rounded-lg bg-cream flex items-center justify-center text-2xl flex-shrink-0">
                  🌿
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-stone-800 line-clamp-1">{item.name}</p>
                  <p className="text-xs text-stone-500">Qty: {item.qty}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-bold text-burgundy-800">
                    ${(item.price * item.qty).toFixed(2)}
                  </span>
                  <button
                    onClick={() => onRemove(item.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-4 border-t border-stone-100 space-y-3">
            <div className="flex justify-between font-semibold text-stone-800">
              <span>Total</span>
              <span className="text-burgundy-800 font-bold">${total.toFixed(2)}</span>
            </div>
            <button
              id="cart-checkout-btn"
              onClick={onCheckout}
              className="btn-primary w-full"
            >
              Proceed to Checkout →
            </button>
            <p className="text-xs text-stone-400 text-center">
              You'll complete payment securely on The Rustic Vine website.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Shop() {
  const { products, loading, error } = useWixProducts()
  const [cart, setCart]           = useState(loadCart)
  const [showCart, setShowCart]   = useState(false)
  const [search, setSearch]       = useState('')

  const cartCount = cart.reduce((n, i) => n + i.qty, 0)

  const filtered = useMemo(() =>
    products.filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase())
    ),
  [products, search])

  function addToCart(product) {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      const next = existing
        ? prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { id: product.id, name: product.name, price: product.price, qty: 1, checkoutUrl: product.checkoutUrl }]
      saveCart(next)
      return next
    })
  }

  function removeFromCart(id) {
    setCart(prev => { const next = prev.filter(i => i.id !== id); saveCart(next); return next })
  }

  function handleCheckout() {
    // Hand off to Wix hosted checkout
    // In a real integration, build a Wix cart and redirect to checkout URL
    const firstUrl = cart.find(i => i.checkoutUrl)?.checkoutUrl
    if (firstUrl && firstUrl !== '#') {
      window.open(firstUrl, '_blank', 'noopener')
    } else {
      window.open('https://www.therustic-vine.com/shop', '_blank', 'noopener')
    }
  }

  return (
    <main id="shop-page" className="min-h-screen bg-cream pb-6 animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur-sm border-b border-stone-200 px-4 pt-12 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display text-2xl font-bold text-burgundy-800">Shop</h1>
          <button
            id="cart-toggle-btn"
            onClick={() => setShowCart(true)}
            className="relative p-2 rounded-xl hover:bg-burgundy-50 transition-colors"
            aria-label="Open cart"
          >
            <ShoppingCartIcon className="w-6 h-6 text-burgundy-700" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-burgundy-700 text-cream text-xs font-bold rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <input
          id="shop-search"
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search craft kits…"
          className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm
            placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-burgundy-300"
        />
      </header>

      {/* Product grid */}
      <div className="px-4 mt-4">
        {error && (
          <div className="text-center py-4 text-sm text-stone-500">
            Using sample products — connect your Wix API to see real inventory.
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton rounded-2xl aspect-[3/4]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-stone-400 italic py-12 text-sm">
            No products match "{search}"
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={addToCart}
                isInsider={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cart drawer */}
      {showCart && (
        <CartDrawer
          cart={cart}
          onRemove={removeFromCart}
          onClose={() => setShowCart(false)}
          onCheckout={handleCheckout}
        />
      )}
    </main>
  )
}
