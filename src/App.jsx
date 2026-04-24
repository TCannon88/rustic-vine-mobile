import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Suspense, lazy, useEffect, useState } from 'react'
import { HomeIcon, ShoppingBagIcon, PlayCircleIcon, StarIcon, UserCircleIcon } from './components/Icons.jsx'
import logo from './assets/logo.png'

const Home         = lazy(() => import('./pages/Home.jsx'))
const Shop         = lazy(() => import('./pages/Shop.jsx'))
const Live         = lazy(() => import('./pages/Live.jsx'))
const Insiders     = lazy(() => import('./pages/Insiders.jsx'))
const Account      = lazy(() => import('./pages/Account.jsx'))
const AuthCallback = lazy(() => import('./pages/AuthCallback.jsx'))

function BottomNav() {
  const location = useLocation()
  const isLive = location.pathname === '/live'

  const navItems = [
    { to: '/',         icon: HomeIcon,        label: 'Home' },
    { to: '/shop',     icon: ShoppingBagIcon, label: 'Shop' },
    { to: '/live',     icon: PlayCircleIcon,  label: 'Live',    special: true },
    { to: '/insiders', icon: StarIcon,        label: 'Insiders' },
    { to: '/account',  icon: UserCircleIcon,  label: 'Account' },
  ]

  return (
    <nav
      id="bottom-nav"
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200 nav-safe${isLive ? ' hidden' : ''}`}
    >
      <div className="grid grid-cols-5 pt-2">
        {navItems.map(({ to, icon: Icon, label, special }) => (
          <NavLink
            key={to}
            to={to}
            id={`nav-${label.toLowerCase()}`}
            end={to === '/'}
            className={({ isActive }) =>
              special
                ? 'relative flex flex-col items-center gap-0.5 -top-4 bg-burgundy-700 text-cream shadow-warm-lg px-3 py-3 rounded-2xl mx-auto w-fit transition-all duration-200'
                : `flex flex-col items-center gap-0.5 py-1 rounded-xl transition-all duration-200 w-full${isActive ? ' text-burgundy-700' : ' text-stone-400 hover:text-stone-600'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`w-6 h-6 transition-transform duration-200${isActive && !special ? ' scale-110' : ''}`}
                />
                <span className={`text-xs font-medium${special ? ' text-cream' : ''}`}>
                  {label}
                </span>
                {special && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-live-dot" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function PageLoader() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <img
          src={logo}
          alt="The Rustic Vine"
          className="w-28 h-28 object-contain animate-pulse-slow mx-auto"
        />
        <p className="font-display text-burgundy-700 text-lg italic mt-4">Loading…</p>
      </div>
    </div>
  )
}

function OverflowDebug() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const vw = document.documentElement.clientWidth
    // Use 360px as threshold — catches what overflowed at device-width even after
    // Chrome expanded the layout viewport to 980px
    const threshold = 360
    const found = [...document.querySelectorAll('*')]
      .filter(el => {
        const r = el.getBoundingClientRect()
        return el.scrollWidth > threshold || r.width > threshold || r.right > threshold
      })
      .map(el => {
        const sw = el.scrollWidth
        const r = el.getBoundingClientRect()
        const bw = Math.round(r.width)
        const right = Math.round(r.right)
        const id = el.id ? '#'+el.id : ''
        const cls = el.className ? '.'+String(el.className).trim().split(/\s+/).slice(0,3).join('.') : ''
        return `${el.tagName}${id}${cls}: w=${bw} right=${right} scroll=${sw}`
      })
    setItems(found.length ? found : [`vw=${vw} — nothing wider than ${threshold}px`])
  }, [])
  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:9999, background:'rgba(0,0,0,0.85)', color:'#0f0', fontFamily:'monospace', fontSize:'11px', padding:'8px', maxHeight:'50vh', overflowY:'auto' }}>
      <strong style={{color:'#ff0'}}>vw={document.documentElement.clientWidth} — elements wider than 360px:</strong>
      {items.map((s,i) => <div key={i} style={{marginTop:4, wordBreak:'break-all'}}>{s}</div>)}
    </div>
  )
}

export default function App() {
  const isDebug = new URLSearchParams(window.location.search).has('debug')
  return (
    <BrowserRouter>
      {isDebug && <OverflowDebug />}
      <div className="min-h-screen pb-20 w-full overflow-x-hidden">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"               element={<Home />} />
            <Route path="/shop"           element={<Shop />} />
            <Route path="/live"           element={<Live />} />
            <Route path="/insiders"       element={<Insiders />} />
            <Route path="/account"        element={<Account />} />
            <Route path="/auth/callback"  element={<AuthCallback />} />
          </Routes>
        </Suspense>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
