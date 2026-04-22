/**
 * useAblyChat — Live chat via Ably Realtime, token-authenticated through the
 * Cloudflare Worker's POST /chat-token endpoint.
 *
 * Flow:
 *   1. Hook calls POST /chat-token with the caller's Wix access token.
 *   2. Worker verifies the token against Wix Members API, resolves real name
 *      + avatar, then signs and returns a short-lived Ably TokenRequest.
 *   3. Ably client is constructed in authCallback mode — SDK handles token
 *      renewal automatically before expiry.
 *   4. Messages include { text, displayName, avatarUrl } in the payload so
 *      every subscriber renders the real member identity.
 *
 * Props:
 *   enabled     {boolean} — connect only when the chat panel is open
 *   accessToken {string}  — Wix OAuth access token (tokens.accessToken.value)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import Ably from 'ably'

const CF_WORKER_URL = import.meta.env.VITE_CF_WORKER_URL || 'http://localhost:8787'
const CHANNEL       = 'rustic-vine:live-chat'
const MAX_MSGS      = 200

// ── Token fetch ───────────────────────────────────────────────────────────────
async function fetchChatToken(accessToken) {
  const res = await fetch(`${CF_WORKER_URL}/chat-token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ accessToken: accessToken || null }),
    signal:  AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`/chat-token ${res.status}`)
  return res.json() // { tokenRequest, member: { id, name, avatarUrl } }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAblyChat({ enabled = true, accessToken = null } = {}) {
  const [messages,         setMessages]    = useState([])
  const [connectionState,  setConnState]   = useState('initialized')
  const [chatMember,       setChatMember]  = useState(null)

  const channelRef = useRef(null)
  const clientRef  = useRef(null)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function connect() {
      try {
        // ── Initial token fetch (also resolves member identity) ─────────────
        const { tokenRequest, member } = await fetchChatToken(accessToken)
        if (cancelled) return

        setChatMember(member)

        // ── Build Ably client with authCallback ──────────────────────────────
        // authCallback is called on connect and auto-renewed before TTL expires.
        const client = new Ably.Realtime({
          authCallback: async (_, callback) => {
            try {
              const { tokenRequest: tr } = await fetchChatToken(accessToken)
              callback(null, tr)
            } catch (e) {
              callback(e, null)
            }
          },
          // Provide the first token directly so Ably doesn't make a redundant
          // authCallback call on initial connect.
          token:    tokenRequest,
          clientId: member.id,
        })

        clientRef.current = client

        client.connection.on((stateChange) => {
          if (!cancelled) setConnState(stateChange.current)
        })

        // ── Subscribe ────────────────────────────────────────────────────────
        const channel = client.channels.get(CHANNEL)
        channelRef.current = channel

        channel.subscribe('message', (msg) => {
          if (cancelled) return
          setMessages(prev => {
            const next = [...prev, {
              id:        msg.id,
              // displayName is in the payload; clientId is the Wix member ID
              author:    msg.data?.displayName || msg.clientId || 'Guest',
              avatarUrl: msg.data?.avatarUrl   || null,
              text:      msg.data?.text        || '',
              timestamp: msg.timestamp,
              memberId:  msg.clientId,
            }]
            return next.slice(-MAX_MSGS)
          })
        })
      } catch (err) {
        console.error('[useAblyChat] connect error:', err)
        if (!cancelled) setConnState('failed')
      }
    }

    connect()

    return () => {
      cancelled = true
      channelRef.current?.unsubscribe()
      clientRef.current?.close()
      channelRef.current = null
      clientRef.current  = null
    }
  }, [enabled, accessToken])

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const trimmed = text?.trim()
    if (!trimmed) return

    // Optimistic local bubble
    const optimistic = {
      id:        `local-${Date.now()}`,
      author:    chatMember?.name    || 'You',
      avatarUrl: chatMember?.avatarUrl || null,
      text:      trimmed,
      timestamp: Date.now(),
      memberId:  chatMember?.id      || 'local',
      isPending: true,
    }
    setMessages(prev => [...prev, optimistic])

    if (!channelRef.current) return   // panel closed / not connected

    try {
      await channelRef.current.publish('message', {
        text,
        displayName: chatMember?.name     || 'Guest',
        avatarUrl:   chatMember?.avatarUrl || null,
      })
    } catch (err) {
      console.error('[useAblyChat] send error:', err)
    }
  }, [chatMember])

  return { messages, sendMessage, connectionState, chatMember }
}
