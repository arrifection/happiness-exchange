import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { isOwnMessage, messageSenderLabel, resolveMemberId } from '../lib/messageSender.js'

function formatMsgTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDateSeparator(dateStr) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' })
}

function shouldShowDateSeparator(messages, index) {
  if (index === 0) return true
  const curr = new Date(messages[index].created_at)
  const prev = new Date(messages[index - 1].created_at)
  return curr.toDateString() !== prev.toDateString()
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function ChatConversationPage({ apiBase, token, currentUser }) {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingConv, setLoadingConv] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // Load conversation info + messages
  useEffect(() => {
    if (!conversationId || !token) return
    loadConversation()
    loadMessages()
  }, [conversationId, token])

  // Auto scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadConversation() {
    setLoadingConv(true)
    try {
      const res = await fetch(`${apiBase}/api/conversations/my`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        const found = data.find((c) => c.id === conversationId)
        if (found) {
          setConversation(found)
        } else {
          navigate('/messages')
        }
      }
    } catch {
      setError('Could not load conversation.')
    } finally {
      setLoadingConv(false)
    }
  }

  async function loadMessages() {
    setLoadingMsgs(true)
    try {
      const res = await fetch(`${apiBase}/api/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setMessages(data)
      } else {
        setError('Could not load messages.')
      }
    } catch {
      setError('Connection error.')
    } finally {
      setLoadingMsgs(false)
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setSending(true)
    setError('')
    try {
      const res = await fetch(`${apiBase}/api/conversations/${conversationId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: trimmed }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages((prev) => [...prev, data])
        setText('')
        inputRef.current?.focus()
      } else {
        setError(data?.detail || 'Could not send message.')
      }
    } catch {
      setError('Connection error.')
    } finally {
      setSending(false)
    }
  }

  const otherName = conversation
    ? (conversation.giver_id === currentUser?.id ? conversation.receiver_name : conversation.giver_name)
    : ''

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-he-border bg-he-surface px-4 py-3">
        <button
          onClick={() => navigate('/messages')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-[#f5f0ff] transition-colors"
          aria-label="Back to inbox"
        >
          <svg className="h-5 w-5 text-[#8c755f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b4cf6] to-[#c084fc] text-[12px] font-bold text-white">
          {getInitials(otherName)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-[#1f1f1f]">{otherName || '…'}</p>
          {conversation && (
            <p className="truncate text-[10px] text-[#8c755f]">
              re: <span className="font-semibold text-[#8b4cf6]">{conversation.item_title}</span>
            </p>
          )}
        </div>

        {/* Anonymous lock icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#efe7ff] text-[#8b4cf6]" title="Completely anonymous">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {(loadingConv || loadingMsgs) && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#8b4cf6] border-t-transparent" />
          </div>
        )}

        {!loadingMsgs && messages.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#efe7ff]">
              <svg className="h-7 w-7 text-[#8b4cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <p className="text-[13px] font-bold text-[#1f1f1f]">No messages yet</p>
            <p className="mt-1 text-[11px] text-[#68766d]">Send the first message to get started!</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const identityContext = {
            currentUserId: currentUser?.id,
            memberId: resolveMemberId(conversation, currentUser?.id),
            adminId: conversation?.admin_id,
          }
          const isMe = isOwnMessage(msg, { ...identityContext, viewerRole: 'user' })
          const senderLabel = messageSenderLabel(msg, { ...identityContext, viewerRole: 'user' })
          const showSep = shouldShowDateSeparator(messages, i)

          return (
            <div key={msg.id}>
              {showSep && (
                <div className="flex items-center gap-3 py-3">
                  <div className="h-px flex-1 bg-[#efe8da]" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/60">
                    {formatDateSeparator(msg.created_at)}
                  </span>
                  <div className="h-px flex-1 bg-[#efe8da]" />
                </div>
              )}
              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                {!isMe && (
                  <div className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b4cf6]/30 to-[#c084fc]/30 text-[10px] font-bold text-[#8b4cf6] self-end">
                    {getInitials(senderLabel)}
                  </div>
                )}
                <div className={`group max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                      isMe
                        ? 'rounded-br-sm bg-[#8b4cf6] text-white'
                        : 'rounded-bl-sm bg-white text-[#1f1f1f] border border-[#efe8da]'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="mt-0.5 px-1 text-[9px] text-[#8c755f]/60 opacity-0 transition-opacity group-hover:opacity-100">
                    {formatMsgTime(msg.created_at)}
                    {isMe && msg.read && ' · seen'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        {error && (
          <p className="text-center text-[11px] font-medium text-[#c65d4a]">{error}</p>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Sticky input */}
      <form
        onSubmit={handleSend}
        className="sticky bottom-0 flex items-end gap-2 border-t border-he-border bg-he-surface px-4 py-3 pb-safe"
      >
        <div className="flex flex-1 items-end rounded-2xl border border-[#efe8da] bg-[#faf7f1] px-4 py-2 focus-within:border-[#8b4cf6] focus-within:ring-2 focus-within:ring-[#8b4cf6]/10 transition-all">
          <textarea
            ref={inputRef}
            value={text}
            disabled={!currentUser?.is_verified}
            onChange={(e) => {
              setText(e.target.value)
              // Auto-resize
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(e)
              }
            }}
            placeholder={currentUser?.is_verified ? "Type a message…" : "Verify your email to chat"}
            rows={1}
            className="w-full resize-none bg-transparent text-[13px] text-[#1f1f1f] outline-none placeholder-[#8c755f]/50 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ maxHeight: '120px' }}
          />
        </div>

        <button
          type="submit"
          disabled={!text.trim() || sending || !currentUser?.is_verified}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8b4cf6] text-white shadow transition-all hover:bg-[#7b40e6] active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg className="h-4.5 w-4.5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </button>
      </form>
    </div>
  )
}
