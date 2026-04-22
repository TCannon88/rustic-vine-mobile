/**
 * useWixAuth — Wix member OAuth flow
 *
 * Uses OAuthStrategy from @wix/sdk.
 * Tokens are persisted in localStorage.
 *
 * Setup required in Wix Dashboard:
 *   Settings → Advanced → OAuth Apps → Create OAuth App
 *   Redirect URI: http://localhost:5173/auth/callback  (dev)
 *              +  https://<your-domain>/auth/callback  (prod)
 *   Copy the Client ID → VITE_WIX_CLIENT_ID
 */

import { createClient, OAuthStrategy } from '@wix/sdk'
import { members as wixMembersModule } from '@wix/members'
import { groups, members as groupMembersModule, joinGroupRequests } from '@wix/groups'
import { useState, useEffect, useCallback, useRef } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────
const CLIENT_ID     = import.meta.env.VITE_WIX_CLIENT_ID || ''
const TOKENS_KEY    = 'rv:wix_tokens'
const OAUTH_KEY     = 'rv:wix_oauth_data'
const CALLBACK_PATH = '/auth/callback'

// ── Redirect URI resolution ────────────────────────────────────────────────────
// Wix does not accept workers.dev as a redirect domain.
// For non-localhost non-production origins we relay through the Wix site
// (_functions/authCallback), which immediately redirects back to us with the
// same ?code=&state= params so AuthCallback.jsx can complete the exchange.
function getCallbackUri() {
  const origin = window.location.origin
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    return `${origin}${CALLBACK_PATH}`
  }
  if (origin === 'https://app.therustic-vine.com') {
    return `${origin}${CALLBACK_PATH}`
  }
  // workers.dev or any other staging origin — use Wix relay
  return 'https://www.therustic-vine.com/_functions/authCallback'
}

// ── Wix client singleton (recreated when tokens change) ───────────────────────
let _client = null

export function getWixClient(tokens) {
  // Always return a client — even without tokens (visitor mode)
  if (_client && !tokens) return _client

  _client = createClient({
    modules: {
      groups,
      groupMembers: groupMembersModule,
      joinGroupRequests,
      wixMembers: wixMembersModule,
    },
    auth: OAuthStrategy({
      clientId: CLIENT_ID,
      tokens:   tokens ?? null,
    }),
  })

  return _client
}

function loadTokens() {
  try {
    const raw = localStorage.getItem(TOKENS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveTokens(tokens) {
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
  } catch { /* quota exceeded */ }
}

function clearTokens() {
  localStorage.removeItem(TOKENS_KEY)
  localStorage.removeItem(OAUTH_KEY)
}

/**
 * Primary auth hook — manages login state, current member, and OAuth redirect.
 */
export function useWixAuth() {
  const [tokens,        setTokens]        = useState(loadTokens)
  const [currentMember, setCurrentMember] = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)

  const client = getWixClient(tokens)
  const isConfigured = !!CLIENT_ID

  // Load current member when tokens exist
  useEffect(() => {
    let cancelled = false

    async function fetchMember() {
      if (!tokens || !isConfigured) {
        setCurrentMember(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const { member } = await client.wixMembers.getCurrentMember({
          fieldsets: ['FULL'],
        })
        if (!cancelled) setCurrentMember(member)
      } catch (err) {
        console.error('[useWixAuth] getCurrentMember error:', err)
        // Tokens may be expired — clear them
        if (err.message?.includes('401') || err.message?.includes('unauthorized')) {
          clearTokens()
          setTokens(null)
          _client = null
        }
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchMember()
    return () => { cancelled = true }
  }, [tokens, isConfigured])

  /**
   * Redirects the user to Wix's hosted login page.
   * Stores OAuth state data in localStorage for use in the callback.
   */
  const login = useCallback(async () => {
    if (!isConfigured) {
      alert('Wix OAuth is not configured. Add VITE_WIX_CLIENT_ID to your .env file.')
      return
    }
    try {
      const tempClient = getWixClient(null)
      const oAuthData  = tempClient.auth.generateOAuthData(
        getCallbackUri(),
        window.location.href  // originalUri — where to return after login
      )
      localStorage.setItem(OAUTH_KEY, JSON.stringify(oAuthData))
      const { authUrl } = await tempClient.auth.getAuthUrl(oAuthData)
      window.location.href = authUrl
    } catch (err) {
      console.error('[useWixAuth] login error:', err)
      setError(err.message)
    }
  }, [isConfigured])

  /**
   * Clears tokens and member state.
   */
  const logout = useCallback(() => {
    clearTokens()
    setTokens(null)
    setCurrentMember(null)
    _client = null
  }, [])

  const isLoggedIn = !!tokens && !!currentMember

  return {
    isLoggedIn,
    isConfigured,
    currentMember,
    tokens,
    loading,
    error,
    login,
    logout,
    client,
    /** Called from AuthCallback to persist tokens received from OAuth exchange */
    setAuthTokens(t) {
      saveTokens(t)
      setTokens(t)
      _client = null // force client rebuild with new tokens
    },
  }
}
