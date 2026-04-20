import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PushOptIn from '../components/PushOptIn.jsx'
import { ChevronRightIcon, PlayCircleIcon, ShoppingBagIcon } from '../components/Icons.jsx'
import logo from '../assets/logo.png'

const CF_WORKER_URL = import.meta.env.VITE_CF_WORKER_URL || 'http://localhost:8787'

// ── Countdown Timer ─────────────────────────────────────────────────────────
function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState({})

  useEffect(() => {
    function tick() {
      const diff = new Date(targetDate) - Date.now()
      if (diff <= 0) return setTimeLeft({ expired: true })
      setTimeLeft({
        days:    Math.floor(diff / 86400000),
        hours:   Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetDate])

  return timeLeft
}

function CountdownUnit({ value, label }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-display font-bold text-3xl text-cream tabular-nums leading-none">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-cream/70 text-xs uppercase tracking-widest mt-1">{label}</span>
    </div>
  )
}

function CountdownBanner({ event }) {
  const countdown = useCountdown(event?.date)

  if (!event) return null

  return (
    <div className="bg-vine-gradient mx-4 mt-4 rounded-2xl p-5 shadow-warm-lg animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="badge-live">
          <span className="w-2 h-2 rounded-full bg-white animate-live-dot" />
          Coming Up
        </span>
      </div>
      <h2 className="font-display text-cream text-xl font-semibold mt-2 text-balance leading-snug">
        {event.title}
      </h2>
      <p className="text-cream/70 text-sm mt-1">{event.description}</p>

      {/* Countdown */}
      <div className="flex gap-4 mt-4 mb-5">
        {countdown.expired ? (
          <p className="text-gold-light font-semibold animate-pulse-slow">Live now!</p>
        ) : (
          <>
            {countdown.days > 0 && <CountdownUnit value={countdown.days}    label="Days" />}
            <CountdownUnit value={countdown.hours}   label="Hrs"  />
            <CountdownUnit value={countdown.minutes} label="Min"  />
            <CountdownUnit value={countdown.seconds} label="Sec"  />
          </>
        )}
      </div>

      {/* CTAs */}
      <div className="flex gap-3">
        <Link to="/live" id="home-watch-live-btn" className="btn-gold flex-1 text-sm py-2.5 rounded-xl">
          <PlayCircleIcon className="w-4 h-4" />
          Watch Live
        </Link>
        <Link to="/shop" id="home-shop-kit-btn" className="flex-1 text-sm py-2.5 px-4 rounded-xl
          bg-white/15 text-cream font-semibold flex items-center justify-center gap-2
          hover:bg-white/25 transition-colors">
          <ShoppingBagIcon className="w-4 h-4" />
          Shop the Kit
        </Link>
      </div>
    </div>
  )
}

// ── Blog Post Card ──────────────────────────────────────────────────────────
function BlogCard({ post }) {
  const date = post.publishedDate
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(post.publishedDate))
    : ''

  return (
    <a
      id={`blog-${post.id}`}
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card flex gap-3 p-3 hover:shadow-warm-lg transition-shadow active:scale-[0.98] duration-150"
    >
      {post.coverImage && (
        <img
          src={post.coverImage}
          alt={post.title}
          className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
          loading="lazy"
        />
      )}
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-xs text-stone-400 mb-1">{date}</p>
        <h3 className="font-display font-semibold text-stone-800 text-sm line-clamp-2 leading-snug">{post.title}</h3>
        <p className="text-xs text-stone-500 line-clamp-2 mt-1">{post.excerpt}</p>
      </div>
      <ChevronRightIcon className="w-4 h-4 text-stone-300 flex-shrink-0 self-center" />
    </a>
  )
}

// ── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_EVENT = {
  title:       "Spring Wreath Craft-Along with Lisa! 🌸",
  description: "Join us for a live step-by-step wreath tutorial — kits ship the same week!",
  date:        new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days out
  isLive:      false,
}

const DEMO_POSTS = [
  {
    id: 'p1',
    title: '5 Reasons Crafting Is Good for Your Soul',
    excerpt: 'There\'s something deeply spiritual about working with your hands. Here\'s what the research says…',
    publishedDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    coverImage: null,
  },
  {
    id: 'p2',
    title: 'Behind the Kit: Spring Wildflower Wreath',
    excerpt: 'Every material in this kit was hand-selected. Here\'s how I sourced the dried lavender…',
    publishedDate: new Date(Date.now() - 7 * 86400000).toISOString(),
    coverImage: null,
  },
  {
    id: 'p3',
    title: 'VIP Insider Zoom Recap — March Craft Night',
    excerpt: '48 crafters joined us for our monthly Zoom session! Here are the highlights…',
    publishedDate: new Date(Date.now() - 14 * 86400000).toISOString(),
    coverImage: null,
  },
]

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [event,       setEvent]       = useState(DEMO_EVENT)
  const [posts,       setPosts]       = useState(DEMO_POSTS)
  const [postsLoaded, setPostsLoaded] = useState(false)

  // Fetch real event from CF Worker
  useEffect(() => {
    fetch(`${CF_WORKER_URL}/event`, { signal: AbortSignal.timeout(5000) })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setEvent(data) })
      .catch(() => {/* keep demo */})
  }, [])

  // Fetch real blog posts from CF Worker
  useEffect(() => {
    fetch(`${CF_WORKER_URL}/blog-posts?limit=4`, { signal: AbortSignal.timeout(8000) })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPosts(data)
          setPostsLoaded(true)
        }
      })
      .catch(() => {/* keep demo */})
  }, [])

  return (
    <main id="home-page" className="min-h-screen bg-cream pb-6 animate-fade-in">
      {/* Page header */}
      <header className="pt-10 pb-2 px-4 flex flex-col items-center">
        <img
          src={logo}
          alt="The Rustic Vine"
          className="w-36 h-36 object-contain"
        />
        <p className="text-xs uppercase tracking-[0.3em] text-burgundy-400 font-semibold -mt-2 mb-1">
          Faith · Craft · Community
        </p>
        <p className="text-stone-500 text-sm text-center text-balance">
          Find joy, healing, and community through faith-filled DIYs<br />
          and simple handmade creations
        </p>
      </header>

      {/* Countdown to next event */}
      <CountdownBanner event={event} />

      {/* Push notification opt-in */}
      <div className="mt-4">
        <PushOptIn />
      </div>

      {/* Blog feed */}
      <section className="mt-6 px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-burgundy-800 text-lg">From the Blog</h2>
          <a
            href="https://www.therustic-vine.com/blog"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-burgundy-600 font-semibold hover:underline"
          >
            See all
          </a>
        </div>
        <div className="space-y-3">
          {posts.map(post => <BlogCard key={post.id} post={post} />)}
        </div>
      </section>

      {/* Quick shop shortcut */}
      <section className="mt-6 mx-4">
        <Link to="/shop" id="home-shop-shortcut" className="block card p-4 bg-burgundy-50 border-burgundy-100 hover:shadow-warm-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-burgundy-700 flex items-center justify-center flex-shrink-0">
              <ShoppingBagIcon className="w-6 h-6 text-cream" />
            </div>
            <div className="flex-1">
              <p className="font-display font-semibold text-burgundy-800">Shop This Week's Kit</p>
              <p className="text-xs text-stone-500 mt-0.5">Spring Wildflower Wreath — in stock now</p>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-burgundy-300" />
          </div>
        </Link>
      </section>
    </main>
  )
}
