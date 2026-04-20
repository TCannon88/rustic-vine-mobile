import { useRef, useEffect, useState } from 'react'
import { useAblyChat } from '../hooks/useAblyChat.js'
import { SendIcon, XIcon } from './Icons.jsx'

const STATUS_COLORS = {
  connected:    'bg-sage-500',
  connecting:   'bg-gold',
  disconnected: 'bg-red-500',
  demo:         'bg-stone-400',
}

export default function ChatPanel({ isOpen, onClose }) {
  const { messages, sendMessage, connectionState, guestName } = useAblyChat({ enabled: isOpen })
  const [input, setInput]       = useState('')
  const messagesEndRef           = useRef(null)
  const inputRef                 = useRef(null)

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

  const dotColor = STATUS_COLORS[connectionState] || 'bg-stone-400'

  return (
    <div
      className={`flex flex-col bg-white border-t border-stone-200 transition-all duration-300
        ${isOpen ? 'h-72' : 'h-0 overflow-hidden'}`}
      id="chat-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-stone-100 bg-cream/80 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} />
          <span className="font-semibold text-sm text-burgundy-800">Live Chat</span>
          <span className="text-xs text-stone-400">
            {connectionState === 'demo' ? '(preview mode)' : connectionState}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-500">You: <strong>{guestName}</strong></span>
          {onClose && (
            <button
              id="chat-close-btn"
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 transition-colors"
              aria-label="Close chat"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 scrollbar-hide">
        {messages.length === 0 ? (
          <p className="text-center text-stone-400 text-sm py-4 italic">
            Be the first to say hi! 👋
          </p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.author === guestName
            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}
              >
                {!isOwn && (
                  <span className="text-xs font-semibold text-burgundy-600 ml-2">
                    {msg.author}
                  </span>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm
                    ${isOwn
                      ? 'bg-burgundy-700 text-cream rounded-br-sm'
                      : 'bg-stone-100 text-stone-800 rounded-bl-sm'
                    }
                    ${msg.isPending ? 'opacity-60' : 'opacity-100'}
                  `}
                >
                  {msg.text}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
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
            active:scale-95"
          aria-label="Send message"
        >
          <SendIcon className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
