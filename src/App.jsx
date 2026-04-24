import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Suspense, lazy } from 'react'
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

export default function App() {
  return (
    <BrowserRouter>
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
