import { useState } from 'react'
import { ShoppingCartIcon } from './Icons.jsx'
import logo from '../assets/logo.png'

const PLACEHOLDER_IMAGE = logo

const RIBBON_STYLES = {
  'Bestseller':         'bg-burgundy-700 text-cream',
  'On Sale':            'bg-sage-600 text-white',
  'New':                'bg-gold text-burgundy-900',
  'Insider Exclusive':  'bg-burgundy-900 text-gold',
  default:              'bg-stone-600 text-white',
}

/**
 * @param {Object} props
 * @param {Object} props.product   — normalised product from useWixProducts
 * @param {Function} props.onAddToCart
 * @param {boolean}  props.isInsider — show insider pricing
 */
export default function ProductCard({ product, onAddToCart, isInsider = false }) {
  const [imgErr, setImgErr]         = useState(false)
  const [addedAnim, setAddedAnim]   = useState(false)

  const ribbonStyle = RIBBON_STYLES[product.ribbon] || RIBBON_STYLES.default

  function handleAddToCart() {
    onAddToCart?.(product)
    setAddedAnim(true)
    setTimeout(() => setAddedAnim(false), 1200)
  }

  const displayPrice = isInsider && product.salePrice
    ? product.salePrice
    : product.price

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency: product.currency || 'USD',
  }).format(displayPrice)

  const originalFormatted = product.salePrice && new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency: product.currency || 'USD',
  }).format(product.price)

  return (
    <article
      id={`product-${product.id}`}
      className="card group flex flex-col cursor-pointer"
    >
      {/* Product image */}
      <div className="relative overflow-hidden bg-cream">
        <img
          src={imgErr || !product.image ? PLACEHOLDER_IMAGE : product.image}
          alt={product.imageAlt || product.name}
          onError={() => setImgErr(true)}
          className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Ribbon badge */}
        {product.ribbon && (
          <div className={`absolute top-2 left-2 text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${ribbonStyle}`}>
            {product.ribbon}
          </div>
        )}

        {/* Insider price badge */}
        {isInsider && product.salePrice && (
          <div className="absolute top-2 right-2 badge-insider">
            ⭐ Insider Price
          </div>
        )}

        {/* Out of stock overlay */}
        {!product.inStock && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
            <span className="font-semibold text-stone-500 bg-white/90 px-3 py-1 rounded-full text-sm">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <h3 className="font-display font-semibold text-stone-800 leading-tight text-sm line-clamp-2">
          {product.name}
        </h3>

        {product.description && (
          <p className="text-xs text-stone-500 line-clamp-2 flex-1">
            {product.description}
          </p>
        )}

        {/* Price row */}
        <div className="flex items-baseline gap-2">
          <span className={`font-bold text-base ${isInsider && product.salePrice ? 'text-sage-700' : 'text-burgundy-800'}`}>
            {formattedPrice}
          </span>
          {product.salePrice && !isInsider && (
            <span className="text-sm text-stone-400 line-through">{originalFormatted}</span>
          )}
        </div>

        {/* Add to cart */}
        <button
          id={`add-to-cart-${product.id}`}
          onClick={handleAddToCart}
          disabled={!product.inStock}
          className={`btn-primary w-full text-sm py-2.5 mt-1
            ${addedAnim ? 'bg-sage-600 hover:bg-sage-600 scale-95' : ''}
            transition-all duration-300`}
        >
          {addedAnim ? (
            <>✓ Added!</>
          ) : (
            <>
              <ShoppingCartIcon className="w-4 h-4" />
              Add to Cart
            </>
          )}
        </button>
      </div>
    </article>
  )
}
