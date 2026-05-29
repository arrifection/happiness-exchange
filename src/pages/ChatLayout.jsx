import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { showFlash } from '../lib/flash.js'
import { ErrorState, ConversationSkeletonList, MessageSkeletonList } from '../components/ui.jsx'
import './ChatLayout.css'

function formatMsgTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatConvTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return formatMsgTime(dateStr)

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })
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

function getOtherParticipant(conversation, currentUserId) {
  if (!conversation) return { id: null, name: 'Unknown' }
  const isGiver = conversation.giver_id === currentUserId
  return {
    id: isGiver ? conversation.receiver_id : conversation.giver_id,
    name: isGiver ? conversation.receiver_name : conversation.giver_name,
  }
}

function MessagesEmptyIcon({ className = 'h-8 w-8' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  )
}

function GlobalEmptyState() {
  return (
    <div className="he-chat-empty-global">
      <div className="he-chat-empty-global-icon">
        <MessagesEmptyIcon />
      </div>
      <h2 className="mt-4 font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-he-ink">
        No conversations yet
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-he-muted">
        When a request is approved, a private chat will open here so you can coordinate pickup safely.
      </p>
      <p className="mt-3 max-w-md text-[11px] text-he-soft">
        Share only pickup details you&apos;re comfortable sharing.
      </p>
    </div>
  )
}

export default function ChatLayout({ apiBase, token, currentUser }) {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  const [conversations, setConversations] = useState([])
  const [loadingConv, setLoadingConv] = useState(true)
  const [convError, setConvError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  ))

  const [messages, setMessages] = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState('')

  const [showOptions, setShowOptions] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [otherUserOnline, setOtherUserOnline] = useState(false)

  const activeConv = conversations.find((c) => c.id === conversationId)
  const otherParticipant = getOtherParticipant(activeConv, currentUser?.id)
  const iBlockedThem = otherParticipant.id && currentUser?.blocked_users?.includes(otherParticipant.id)

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return conversations

    return conversations.filter((conversation) => {
      const other = getOtherParticipant(conversation, currentUser?.id)
      return (
        other.name?.toLowerCase().includes(query)
        || conversation.item_title?.toLowerCase().includes(query)
        || conversation.last_message_text?.toLowerCase().includes(query)
      )
    })
  }, [conversations, searchQuery, currentUser?.id])

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!token) return undefined
    loadConversations()
    const interval = setInterval(loadConversations, 15000)
    return () => clearInterval(interval)
  }, [token])

  useEffect(() => {
    if (!conversationId || !token) {
      setMessages([])
      return undefined
    }
    loadMessages()
    const interval = setInterval(loadMessages, 10000)
    return () => clearInterval(interval)
  }, [conversationId, token])

  useEffect(() => {
    if (!activeConv || !token) return undefined
    const checkStatus = async () => {
      const otherId = activeConv.giver_id === currentUser?.id ? activeConv.receiver_id : activeConv.giver_id
      try {
        const res = await fetch(`${apiBase}/api/users/${otherId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok && data.last_online_at) {
          const lastOnline = new Date(data.last_online_at).getTime()
          const now = new Date().getTime()
          setOtherUserOnline(now - lastOnline < 120000)
        }
      } catch {
        /* silent */
      }
    }
    checkStatus()
    const intv = setInterval(checkStatus, 30000)
    return () => clearInterval(intv)
  }, [activeConv, token, apiBase, currentUser?.id])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [messages])

  async function loadConversations() {
    setConvError('')
    try {
      const res = await fetch(`${apiBase}/api/conversations/my`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setConversations(Array.isArray(data) ? data : [])
      } else {
        setConvError(data?.detail || 'Could not load conversations.')
      }
    } catch {
      setConvError('Unable to reach the server. Check your connection and try again.')
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
      if (res.ok) setMessages(Array.isArray(data) ? data : [])
    } catch {
      setError('Could not load messages. Pull to refresh by reopening the chat.')
    } finally {
      setLoadingMsgs(false)
    }
  }

  async function handleSend(e) {
    if (e) e.preventDefault()
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
        body: JSON.stringify({ text: trimmed, message_type: 'text' }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages((prev) => [...prev, data])
        setText('')
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      } else {
        setError(data?.detail || 'Could not send message.')
      }
    } catch {
      setError('Connection error.')
    } finally {
      setSending(false)
    }
  }

  async function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.')
      return
    }

    setUploadingImage(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${apiBase}/api/conversations/${conversationId}/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        await sendImageMessage(data.image_url)
      } else {
        setError(data?.detail || 'Could not upload image.')
      }
    } catch {
      setError('Connection error.')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function sendImageMessage(imageUrl) {
    try {
      const res = await fetch(`${apiBase}/api/conversations/${conversationId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: '', message_type: 'image', image_url: imageUrl }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages((prev) => [...prev, data])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      } else {
        setError(data?.detail || 'Could not send message.')
      }
    } catch {
      setError('Connection error.')
    }
  }

  async function handleBlock() {
    if (!activeConv || !confirm("Block this user? You won't receive messages from them anymore.")) return
    const otherId = activeConv.giver_id === currentUser?.id ? activeConv.receiver_id : activeConv.giver_id
    try {
      const res = await fetch(`${apiBase}/api/users/${otherId}/block`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        showFlash('User blocked.')
        navigate('/messages')
      } else {
        const data = await res.json()
        showFlash(data.detail || 'Block failed.')
      }
    } catch {
      showFlash('Connection error.')
    }
  }

  async function handleReport(e) {
    e.preventDefault()
    if (!reportReason) return
    try {
      const res = await fetch(`${apiBase}/api/conversations/${conversationId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reportReason }),
      })
      if (res.ok) {
        showFlash('Chat reported to admins.')
        setReportModalOpen(false)
        setShowOptions(false)
      } else {
        showFlash('Failed to report.')
      }
    } catch {
      showFlash('Connection error.')
    }
  }

  const showSidebar = !isMobile || !conversationId
  const showChatPanel = !isMobile || Boolean(conversationId)
  const showGlobalEmpty = !loadingConv && !convError && conversations.length === 0

  function renderConversationList() {
    if (loadingConv) return <ConversationSkeletonList count={5} />

    if (convError) {
      return (
        <div className="p-4">
          <ErrorState
            title="Couldn't load conversations"
            message={convError}
            onRetry={loadConversations}
            className="mx-0 p-4"
          />
        </div>
      )
    }

    if (filteredConversations.length === 0) {
      return (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-semibold text-he-ink">No matches found</p>
          <p className="mt-1 text-xs text-he-muted">Try another name or item title.</p>
        </div>
      )
    }

    return (
      <div className="divide-y divide-he-border/70">
        {filteredConversations.map((conversation) => {
          const other = getOtherParticipant(conversation, currentUser?.id)
          const isActive = conversation.id === conversationId
          const unread = conversation.unread_count > 0

          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => navigate(`/messages/${conversation.id}`)}
              className={`he-chat-conv-row ${isActive ? 'is-active' : ''}`}
            >
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b4cf6] to-[#c084fc] text-xs font-bold text-white">
                {getInitials(other.name)}
                {unread ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-he-surface-soft bg-red-500 px-1 text-[9px] font-bold text-white">
                    {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                  </span>
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-start justify-between gap-2">
                  <p className={`truncate text-sm ${unread ? 'font-bold text-he-ink' : 'font-semibold text-he-ink'}`}>
                    {other.name || 'Unknown'}
                  </p>
                  <span className="shrink-0 text-[10px] text-he-muted">
                    {formatConvTime(conversation.last_message_at)}
                  </span>
                </div>
                <p className="truncate text-[11px] font-medium text-he-purple">
                  {conversation.item_title || 'Item chat'}
                </p>
                <p className={`mt-0.5 truncate text-xs ${unread ? 'font-medium text-he-ink' : 'text-he-soft'}`}>
                  {conversation.last_message_text || 'No messages yet'}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  function renderChatHeader() {
    if (!activeConv) return null

    return (
      <div className="z-20 shrink-0 border-b border-he-border bg-he-surface">
        <div className="flex items-center gap-3 px-3 py-3 md:px-4">
          <button
            type="button"
            onClick={() => navigate('/messages')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-he-surface-soft md:hidden"
            aria-label="Back to conversations"
          >
            <svg className="h-5 w-5 text-he-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b4cf6] to-[#c084fc] text-xs font-bold text-white">
            {getInitials(otherParticipant.name)}
            {otherUserOnline ? (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-he-surface bg-green-500" />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-bold text-he-ink">{otherParticipant.name}</p>
              <span className="inline-flex items-center rounded-full bg-[#efe7ff] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#8b4cf6] dark:bg-[#2d2640] dark:text-[#c4b5fd]">
                Pickup chat
              </span>
            </div>
            <p className="truncate text-xs text-he-muted">{activeConv.item_title}</p>
            {otherUserOnline ? (
              <p className="text-[10px] font-medium text-green-600 dark:text-green-400">Online</p>
            ) : (
              <p className="text-[10px] text-he-soft">Share only pickup details you&apos;re comfortable sharing.</p>
            )}
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className="rounded-full p-2 text-he-soft hover:bg-he-surface-soft"
              aria-label="Chat options"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v.01M12 12v.01M12 18v.01" />
              </svg>
            </button>
            {showOptions ? (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowOptions(false)} role="presentation" />
                <div className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-xl border border-he-border bg-he-surface shadow-lg">
                  <button
                    type="button"
                    onClick={handleBlock}
                    className="w-full border-b border-he-border px-4 py-3 text-left text-sm font-semibold text-[#c65d4a] hover:bg-rose-950/30"
                  >
                    Block user
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReportModalOpen(true); setShowOptions(false) }}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-he-ink hover:bg-he-surface-soft"
                  >
                    Report chat
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  function renderMessages() {
    if (loadingMsgs) return <MessageSkeletonList count={5} />

    if (messages.length === 0) {
      return (
        <div className="he-chat-empty-inline">
          <div className="he-chat-empty-global-icon h-14 w-14">
            <MessagesEmptyIcon className="h-7 w-7" />
          </div>
          <p className="mt-3 text-sm font-semibold text-he-ink">Start the conversation</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-he-muted">
            Send a message to coordinate pickup. Keep details respectful and stay within the app.
          </p>
        </div>
      )
    }

    return messages.map((msg, i) => {
      const isMe = msg.sender_id === currentUser?.id
      const showSep = shouldShowDateSeparator(messages, i)

      return (
        <div key={msg.id}>
          {showSep ? (
            <div className="flex items-center gap-3 py-3">
              <div className="h-px flex-1 bg-he-border" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-he-soft/60">
                {formatDateSeparator(msg.created_at)}
              </span>
              <div className="h-px flex-1 bg-he-border" />
            </div>
          ) : null}
          <div className={`mb-2 flex ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-full flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`he-chat-bubble ${isMe ? 'he-chat-bubble--mine' : 'he-chat-bubble--theirs'}`}>
                {msg.message_type === 'image' && msg.image_url ? (
                  <img
                    src={msg.image_url}
                    alt="Shared"
                    className="max-h-64 w-full max-w-full cursor-pointer object-cover hover:opacity-95"
                  />
                ) : (
                  <div className="whitespace-pre-wrap px-4 py-2.5">{msg.text}</div>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1 px-1">
                <span className="text-[10px] text-he-soft/60">{formatMsgTime(msg.created_at)}</span>
                {isMe ? (
                  <svg className={`h-3.5 w-3.5 ${msg.read ? 'text-blue-400' : 'text-he-soft/40'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )
    })
  }

  function renderInputBar() {
    if (!activeConv) return null

    return (
      <form onSubmit={handleSend} className="he-chat-input-bar">
        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage || !currentUser?.is_verified || iBlockedThem}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-he-soft transition-colors hover:bg-he-surface-soft hover:text-he-purple disabled:opacity-50"
          aria-label="Attach image"
        >
          {uploadingImage ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-he-purple border-t-transparent" />
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          )}
        </button>

        <div className="flex min-h-[2.75rem] flex-1 items-end rounded-2xl border border-he-border bg-he-surface-soft px-3 py-2 transition-all focus-within:border-he-purple focus-within:ring-2 focus-within:ring-he-purple/10">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!currentUser?.is_verified || iBlockedThem}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(e)
              }
            }}
            placeholder={
              iBlockedThem
                ? 'You blocked this user.'
                : (currentUser?.is_verified ? 'Type a message…' : 'Verify email to chat')
            }
            rows={1}
            className="max-h-32 w-full resize-none bg-transparent text-sm text-he-ink outline-none placeholder:text-he-soft/50 disabled:opacity-60"
            style={{ minHeight: '24px' }}
          />
        </div>

        <button
          type="submit"
          disabled={!text.trim() || sending || !currentUser?.is_verified || iBlockedThem}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-he-purple text-white shadow-sm transition-all hover:bg-[#7b40e6] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          {sending ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg className="ml-0.5 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </button>
      </form>
    )
  }

  if (showGlobalEmpty) {
    return (
      <div className="he-chat-shell">
        <GlobalEmptyState />
      </div>
    )
  }

  return (
    <div className="he-chat-shell">
      {showSidebar ? (
        <aside className="he-chat-sidebar">
          <div className="shrink-0 border-b border-he-border bg-he-surface px-4 py-3">
            <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-he-ink">Messages</h2>
            <div className="relative mt-3">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-he-soft/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations"
                className="he-chat-search"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {renderConversationList()}
          </div>
        </aside>
      ) : null}

      {showChatPanel ? (
        <section className="he-chat-main">
          {activeConv ? (
            <>
              {renderChatHeader()}
              <div className="he-chat-messages">
                {renderMessages()}
                {error ? <p className="my-2 text-center text-[11px] font-medium text-[#c65d4a]">{error}</p> : null}
                <div ref={bottomRef} className="h-2" />
              </div>
              {renderInputBar()}
            </>
          ) : (
            <div className="he-chat-desktop-placeholder">
              <div className="he-chat-empty-global-icon">
                <MessagesEmptyIcon />
              </div>
              <h3 className="mt-4 font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-he-ink">
                Select a conversation
              </h3>
              <p className="mt-2 max-w-sm text-sm text-he-muted">
                Choose a chat from the left to view messages and coordinate pickup safely.
              </p>
            </div>
          )}
        </section>
      ) : null}

      {reportModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="animate-slide-in w-full max-w-sm overflow-hidden rounded-2xl bg-he-surface shadow-xl">
            <div className="border-b border-he-border p-4">
              <h3 className="font-bold text-he-ink">Report conversation</h3>
            </div>
            <form onSubmit={handleReport} className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-he-soft" htmlFor="report-reason">
                  Reason for reporting
                </label>
                <select
                  id="report-reason"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="he-field rounded-xl px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select a reason...</option>
                  <option value="spam">Spam or unwanted advertising</option>
                  <option value="harassment">Harassment or abusive language</option>
                  <option value="scam">Suspected scam or fraud</option>
                  <option value="inappropriate">Inappropriate content or images</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setReportModalOpen(false)} className="rounded-full px-4 py-2 text-sm font-bold text-he-soft transition-colors hover:bg-he-surface-soft">
                  Cancel
                </button>
                <button type="submit" disabled={!reportReason} className="rounded-full bg-[#c65d4a] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#b05241] disabled:opacity-50">
                  Submit report
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
