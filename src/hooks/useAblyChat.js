import { useState, useEffect, useRef, useCallback } from 'react'
import Ably from 'ably'

const ABLY_KEY   = import.meta.env.VITE_ABLY_SUBSCRIBE_KEY || ''
const CHANNEL    = 'rustic-vine:live-chat'
const MAX_MSGS   = 200

let ablyClient = null

function getAblyClient() {
  if (!ablyClient && ABLY_KEY) {
    ablyClient = new Ably.Realtime({
      key: ABLY_KEY,
      clientId: getGuestName(),
    })
  }
  return ablyClient
}

function getGuestName() {
  const stored = localStorage.getItem('rv:chat_name')
  if (stored) return stored
  const name = `Crafter#${Math.floor(1000 + Math.random() * 9000)}`
  localStorage.setItem('rv:chat_name', name)
  return name
}

/**
 * Connects to the Ably live-chat channel and returns messages + sendMessage.
 */
export function useAblyChat({ enabled = true } = {}) {
  const [messages, setMessages]           = useState([])
  const [connectionState, setConnState]   = useState('initialized')
  const channelRef = useRef(null)
  const guestName  = getGuestName()

  useEffect(() => {
    if (!enabled) return

    const client = getAblyClient()
    if (!client) {
      // Ably not configured — use demo mode with local messages only
      setConnState('demo')
      return
    }

    const channel = client.channels.get(CHANNEL)
    channelRef.current = channel

    // Track connection state
    client.connection.on((stateChange) => {
      setConnState(stateChange.current)
    })

    // Subscribe to incoming messages
    channel.subscribe('message', (msg) => {
      setMessages(prev => {
        const next = [...prev, {
          id:        msg.id,
          author:    msg.clientId || 'Guest',
          text:      msg.data.text,
          timestamp: msg.timestamp,
        }]
        return next.slice(-MAX_MSGS) // keep last 200
      })
    })

    return () => {
      channel.unsubscribe()
    }
  }, [enabled])

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const optimistic = {
      id:        `local-${Date.now()}`,
      author:    guestName,
      text:      trimmed,
      timestamp: Date.now(),
      isPending: true,
    }

    // Optimistic local display
    setMessages(prev => [...prev, optimistic])

    if (!channelRef.current) {
      // Demo mode — just show locally
      return
    }

    try {
      await channelRef.current.publish('message', { text: trimmed })
    } catch (err) {
      console.error('[useAblyChat] send error:', err)
    }
  }, [guestName])

  return { messages, sendMessage, connectionState, guestName }
}
