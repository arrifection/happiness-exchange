import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function ConversationItem({ conv, currentUserId }) {
  const otherName =
    conv.giver_id === currentUserId ? conv.receiver_name : conv.giver_name
  const hasUnread = conv.unread_count > 0

  return (
    <Link
      to={`/messages/${conv.id}`}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-200 hover:bg-[#f5f0ff] active:scale-[0.99] ${hasUnread ? 'bg-[#efe7ff]/40' : 'bg-white'}`}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#8b4cf6] to-[#c084fc] text-[13px] font-bold text-white shadow-sm">
          {getInitials(otherName)}
        </div>
        {hasUnread && (
          <div className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#8b4cf6] text-[9px] font-bold text-white shadow">
            {conv.unread_count > 9 ? '9+' : conv.unread_count}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`truncate text-[13px] font-bold ${hasUnread ? 'text-[#1f1f1f]' : 'text-[#2d2d2d]'}`}>
            {otherName}
          </p>
          <span className="shrink-0 text-[10px] text-[#8c755f]/70">
            {formatTime(conv.last_message_at)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-[#68766d]">
          <span className="font-semibold text-[#8b4cf6]/80">re: {conv.item_title}</span>
        </p>
        <p className={`mt-0.5 truncate text-[11px] ${hasUnread ? 'font-semibold text-[#1f1f1f]' : 'text-[#8c755f]'}`}>
          {conv.last_message_text || 'Start the conversation…'}
        </p>
      </div>

      {/* Arrow */}
      <svg className="h-4 w-4 shrink-0 text-[#8c755f]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#8b4cf6]/10 to-[#ffcc22]/20">
        <svg className="h-10 w-10 text-[#8b4cf6]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      </div>
      <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-[#1f1f1f]">
        No messages yet
      </h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#68766d]">
        When a request is approved, a private chat opens between you and the other member.
      </p>
      <Link
        to="/browse"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#8b4cf6] px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow transition hover:bg-[#7b40e6]"
      >
        Browse Items
      </Link>
    </div>
  )
}

export default function ChatInboxPage({ apiBase, token, currentUser }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${apiBase}/api/conversations/my`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok) {
          setConversations(data)
        } else {
          setError('Unable to load messages.')
        }
      } catch {
        setError('Connection error.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [apiBase, token])

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold tracking-tight text-[#1f1f1f]">
            Messages
            {totalUnread > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-[#8b4cf6] px-2 py-0.5 text-[10px] font-bold text-white">
                {totalUnread} new
              </span>
            )}
          </h1>
          <p className="text-[11px] text-[#68766d]">Private chats with exchange partners</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#efe7ff] text-[#8b4cf6]">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </div>
      </div>

      {/* Anonymous Trust Stamp */}
      <div className="flex items-center gap-2 rounded-2xl border border-[#8b4cf6]/15 bg-[#efe7ff]/30 px-4 py-2.5">
        <svg className="h-4 w-4 shrink-0 text-[#8b4cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        <p className="text-[10px] font-bold text-[#8b4cf6]">
          Completely Anonymous · Messages are private between participants only
        </p>
      </div>

      {/* Conversation List */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-[#f5f0ff]/60" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-center text-sm font-medium text-[#c65d4a]">{error}</p>
      )}

      {!loading && !error && conversations.length === 0 && <EmptyInbox />}

      {!loading && !error && conversations.length > 0 && (
        <div className="divide-y divide-[#efe8da]/50 rounded-2xl border border-[#efe8da] bg-white shadow-sm overflow-hidden">
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              currentUserId={currentUser?.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
