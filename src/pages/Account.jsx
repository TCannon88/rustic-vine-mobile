import { usePushSubscription } from '../hooks/usePushSubscription.js'
import { BellIcon } from '../components/Icons.jsx'
import logo from '../assets/logo.png'

export default function Account() {
  const { isSubscribed, isSupported, permission, isLoading, subscribe, unsubscribe } = usePushSubscription()

  return (
    <main id="account-page" className="min-h-screen bg-cream pb-6 animate-fade-in">
      <header className="pt-14 pb-6 px-4 bg-vine-gradient">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-warm">
            <img
              src={logo}
              alt="The Rustic Vine"
              className="w-12 h-12 object-contain"
            />
          </div>
          <div>
            <h1 className="font-display text-cream text-xl font-semibold">My Account</h1>
            <p className="text-cream/70 text-sm mt-0.5">Sign in coming soon</p>
          </div>
        </div>
      </header>

      <div className="px-4 mt-6 space-y-4">
        {/* Sign in placeholder */}
        <div className="card p-5">
          <h2 className="font-display font-semibold text-burgundy-800 mb-2">Sign In</h2>
          <p className="text-sm text-stone-500 mb-4">
            Wix member authentication is coming in a future update. You'll be able to view orders, manage your subscription, and access Insider content.
          </p>
          <a
            id="account-signin-btn"
            href="https://www.therustic-vine.com/account/login"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-sm py-2"
          >
            Sign in on Website
          </a>
        </div>

        {/* Push notifications */}
        <div className="card p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-burgundy-100 flex items-center justify-center flex-shrink-0">
              <BellIcon className="w-5 h-5 text-burgundy-700" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-stone-800 text-sm">Push Notifications</h2>
              <p className="text-xs text-stone-500 mt-1 mb-3">
                {!isSupported
                  ? 'Not supported in this browser.'
                  : permission === 'denied'
                    ? 'Notifications are blocked. Enable them in your browser settings.'
                    : isSubscribed
                      ? "You're subscribed! You'll hear from us when Lisa goes live."
                      : "Get notified when Lisa goes live, new kits drop, and deals are on."}
              </p>
              {isSupported && permission !== 'denied' && (
                <button
                  id="account-push-toggle"
                  onClick={isSubscribed ? unsubscribe : subscribe}
                  disabled={isLoading}
                  className={isSubscribed ? 'btn-outline text-sm py-2' : 'btn-primary text-sm py-2'}
                >
                  {isLoading
                    ? 'Updating…'
                    : isSubscribed
                      ? 'Turn off notifications'
                      : '🔔 Turn on notifications'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Donation link */}
        <div className="card p-5 bg-burgundy-50 border-burgundy-100 text-center">
          <p className="text-2xl mb-2">🙏</p>
          <h3 className="font-display font-semibold text-burgundy-800 mb-1">Support Our Mission</h3>
          <p className="text-xs text-stone-500 mb-3">
            The Rustic Vine donates a portion of every sale to community craft programs.
          </p>
          <a
            id="account-donate-btn"
            href="https://www.therustic-vine.com/donate"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold inline-flex text-sm py-2"
          >
            Make a Donation
          </a>
        </div>
      </div>
    </main>
  )
}
