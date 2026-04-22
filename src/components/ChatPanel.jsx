import { useRef, useEffect, useState } from 'react'
import { useAblyChat } from '../hooks/useAblyChat.js'
import { SendIcon, XIcon } from './Icons.jsx'

const STATUS_COLORS = {
  connected:    'bg-sage-500',
  connecting:   'bg-gold animate-pulse',
  disconnected: 'bg-red-500',
  failed:       'bg-red-500',
  initialized:  'bg-stone-400',
}

// ── Avatar helper ─────────────────────────────────────────────────────────────
function Avatar({ name, avatarUrl, size = 'w-7 h-7' }) {
  const initials = (name || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${size} rounded-full object-cover flex-shrink-0 border border-stone-200`}
      />
    )
  }

  // Deterministic background colour from name
  const colours = [
    'bg-burgundy-600', 'bg-sage-600', 'bg-gold/80',
    'bg-stone-500',    'bg-indigo-500', 'bg-rose-500',
  ]
  const colour = colours[(name || '').charCodeAt(0) % colours.length]

  return (
    <div
      className={`${size} rounded-full ${colour} flex items-center justify-center
        flex-shrink-0 text-white text-[10px] font-bold border border-white/20`}
    >
      {initials}
    </div>
  )
}

// ── ChatPanel ─────────────────────────────────────────────────────────────────
/**
 * @param {boolean}  isOpen      — slides panel open/closed
 * @param {function} onClose     — close button handler
 * @param {string}   accessToken — Wix OAuth access token (tokens.accessToken.value)
 */
export default function ChatPanel({ isOpen, onClose, accessToken }) {
  const { messages, sendMessage, connectionState, chatMember } =
    useAblyChat({ enabled: isOpen, accessToken })

  const [input, setInput]   = useState('')
  const messagesEndRef       = useRef(null)
  const inputRef             = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e) {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
    inputRef.current?.focus()
  }

  const dotColor    = STATUS_COLORS[connectionState] || 'bg-stone-400'
  const displayName = chatMember?.name || '…'
  const isGuest     = chatMember?.id?.startsWith('guest-')

  return (
    <div
      className={`flex flex-col bg-white border-t border-stone-200 transition-all duration-300
        ${isOpen ? 'h-72' : 'h-0 overflow-hidden'}`}
      id="chat-panel"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-stone-100 bg-cream/80 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className="font-semibold text-sm text-burgundy-800">Live Chat</span>
          {connectionState !== 'connected' && (
            <span className="text-xs text-stone-400 capitalize">{connectionState}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {chatMember && (
            <div className="flex items-center gap-1.5">
              <Avatar name={chatMember.name} avatarUrl={chatMember.avatarUrl} size="w-6 h-6" />
              <span className="text-xs text-stone-500">
                {isGuest ? (
                  <span className="italic">{displayName}</span>
                ) : (
                  <strong className="text-burgundy-700">{displayName}</strong>
                )}
              </span>
            </div>
          )}

          {onClose && (
            <button
              id="chat-close-btn"
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 transition-colors ml-1"
              aria-label="Close chat"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5 scrollbar-hide">
        {messages.length === 0 ? (
          <p className="text-center text-stone-400 text-sm py-4 italic">
            Be the first to say hi! 👋
          </p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.memberId === chatMember?.id
            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar — only for other people's messages */}
                {!isOwn && (
                  <Avatar
                    name={msg.author}
                    avatarUrl={msg.avatarUrl}
                    size="w-7 h-7"
                  />
                )}

                <div className={`flex flex-col gap-0.5 max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                  {!isOwn && (
                    <span className="text-[11px] font-semibold text-burgundy-600 ml-1">
                      {msg.author}
                    </span>
                  )}
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm leading-snug
                      ${isOwn
                        ? 'bg-burgundy-700 text-cream rounded-br-sm'
                        : 'bg-stone-100 text-stone-800 rounded-bl-sm'
                      }
                      ${msg.isPending ? 'opacity-60' : 'opacity-100'}
                      transition-opacity duration-300`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-3 py-2 border-t border-stone-100 flex-shrink-0"
      >
        <input
          ref={inputRef}
          id="chat-input"
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Say something nice…"
          maxLength={280}
          className="flex-1 bg-stone-100 rounded-full px-4 py-2 text-sm
            placeholder:text-stone-400 text-stone-800
            focus:outline-none focus:ring-2 focus:ring-burgundy-400
            transition-all duration-200"
        />
        <button
          id="chat-send-btn"
          type="submit"
          disabled={!input.trim()}
          className="w-9 h-9 rounded-full bg-burgundy-700 text-cream flex items-center justify-center
            disabled:opacity-40 hover:bg-burgundy-800 transition-all duration-200
            active:scale-95 flex-shrink-0"
          aria-label="Send message"
        >
          <SendIcon className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
