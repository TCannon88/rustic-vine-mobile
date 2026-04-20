/**
 * AuthCallback — handles the OAuth redirect from Wix.
 *
 * Wix redirects here after the user signs in, with ?code=&state= in the URL.
 * This page exchanges the code for member tokens and redirects to /insiders.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getWixClient } from '../hooks/useWixAuth.js'
import logo from '../assets/logo.png'

const OAUTH_KEY = 'rv:wix_oauth_data'
const TOKENS_KEY = 'rv:wix_tokens'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Signing you in…')
  const [failed,  setFailed]  = useState(false)

  useEffect(() => {
    async function handleCallback() {
      try {
        // 1. Retrieve stored OAuth state
        const storedOAuth = localStorage.getItem(OAUTH_KEY)
        if (!storedOAuth) throw new Error('OAuth state not found. Please try signing in again.')
        const oAuthData = JSON.parse(storedOAuth)

        // 2. Parse the callback URL (code + state live in the current URL)
        const client = getWixClient(null)
        const { code, state } = client.auth.parseFromUrl()

        setStatus('Exchanging auth code for tokens…')

        // 3. Exchange code → member tokens
        const memberTokens = await client.auth.getMemberTokens(code, state, oAuthData)

        // 4. Persist tokens
        localStorage.setItem(TOKENS_KEY, JSON.stringify(memberTokens))
        localStorage.removeItem(OAUTH_KEY)

        setStatus('Logged in! Taking you to Insiders…')

        // 5. Navigate back to Insiders (where the user came from)
        setTimeout(() => navigate('/insiders', { replace: true }), 800)
      } catch (err) {
        console.error('[AuthCallback] error:', err)
        setStatus(err.message || 'Authentication failed')
        setFailed(true)
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 animate-fade-in">
      <div className="card p-8 max-w-sm w-full text-center space-y-4">
        {/* Logo */}
        <div className="w-20 h-20 mx-auto flex items-center justify-center">
          <img
            src={logo}
            alt="The Rustic Vine"
            className="w-20 h-20 object-contain"
          />
        </div>

        {failed ? (
          <>
            <h2 className="font-display text-burgundy-800 text-xl font-semibold">Sign-in failed</h2>
            <p className="text-stone-500 text-sm leading-relaxed">{status}</p>
            <button
              id="auth-callback-retry"
              onClick={() => navigate('/insiders', { replace: true })}
              className="btn-primary w-full mt-2"
            >
              Back to Insiders
            </button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 mx-auto border-4 border-burgundy-200 border-t-burgundy-700 rounded-full animate-spin" />
            <p className="font-display text-burgundy-700 italic">{status}</p>
          </>
        )}
      </div>
    </div>
  )
}
