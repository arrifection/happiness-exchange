import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MessageSquare, Send } from 'lucide-react'
import { conversationsApi } from '../lib/api'
import { resolveApiError } from '../lib/backend'
import { EmptyState, ErrorState, LoadingSpinner } from '../components/States'

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function getInitials(name) {
  if (!name) return 'HE'
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

export default function MessagesPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const bottomRef = useRef(null)

  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState('')
  const [sendError, setSendError] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')

  const activeConv = conversations.find((c) => c.id === conversationId)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return conversations
    return conversations.filter((conv) =>
      conv.list_title?.toLowerCase().includes(query)
      || conv.member_name?.toLowerCase().includes(query)
      || conv.item_title?.toLowerCase().includes(query),
    )
  }, [conversations, search])

  async function loadConversations() {
    setError('')
    try {
      const res = await conversationsApi.list()
      setConversations(res.data || [])
    } catch (err) {
      setError(resolveApiError(err))
    } finally {
      setLoadingList(false)
    }
  }

  async function loadMessages(id) {
    if (!id) {
      setMessages([])
      return
    }
    setLoadingMessages(true)
    setSendError('')
    try {
      const res = await conversationsApi.messages(id)
      setMessages(res.data || [])
    } catch (err) {
      setSendError(resolveApiError(err))
    } finally {
      setLoadingMessages(false)
    }
  }

  useEffect(() => {
    loadConversations()
    const interval = setInterval(loadConversations, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    loadMessages(conversationId)
    if (!conversationId) return undefined
    const interval = setInterval(() => loadMessages(conversationId), 10000)
    return () => clearInterval(interval)
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !conversationId || sending) return

    setSending(true)
    setSendError('')
    try {
      const res = await conversationsApi.sendMessage(conversationId, {
        text: trimmed,
        message_type: 'text',
      })
      setMessages((prev) => [...prev, res.data])
      setText('')
      await loadConversations()
    } catch (err) {
      setSendError(resolveApiError(err))
    } finally {
      setSending(false)
    }
  }

  if (loadingList) return <LoadingSpinner message="Loading mediated chats…" />

  return (
    <div className="animate-slide-in">
      <div className="page-header">
        <h2 className="page-title">Messages</h2>
        <p className="page-subtitle">Admin-mediated pickup coordination for approved requests</p>
      </div>

      {error ? <ErrorState message={error} onRetry={loadConversations} /> : null}

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 min-h-[620px]">
        <aside className="card p-0 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-surface-300">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              className="input w-full"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No mediated chats yet"
                description="Chats appear here after a request is approved."
              />
            ) : (
              filtered.map((conv) => {
                const isActive = conv.id === conversationId
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => navigate(`/messages/${conv.id}`)}
                    className={`w-full text-left px-4 py-3 border-b border-surface-200 transition-colors ${
                      isActive ? 'bg-brand-50 border-l-4 border-l-brand-500' : 'hover:bg-lavender-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {getInitials(conv.member_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-surface-800 truncate">
                          {conv.list_title || conv.item_title}
                        </p>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600 mt-0.5">
                          {conv.role_label || (conv.member_role === 'receiver' ? 'Receiver' : 'Lister')}
                        </p>
                        <p className="text-xs text-surface-500 truncate mt-1">
                          {conv.last_message_text || 'No messages yet'}
                        </p>
                      </div>
                      {conv.unread_count > 0 ? (
                        <span className="badge-red">{conv.unread_count}</span>
                      ) : null}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <section className="card p-0 overflow-hidden flex flex-col min-h-[620px]">
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div>
                <MessageSquare className="w-10 h-10 text-surface-400 mx-auto" />
                <h3 className="mt-4 text-lg font-semibold text-surface-800">Select a chat</h3>
                <p className="mt-2 text-sm text-surface-500 max-w-sm">
                  Choose a receiver or lister chat to coordinate pickup without direct member messaging.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-surface-300 bg-white">
                <p className="text-sm font-semibold text-surface-800">{activeConv.list_title}</p>
                <p className="text-xs text-surface-500 mt-1">
                  You are messaging as Happiness Exchange Admin
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-surface-100">
                {loadingMessages ? (
                  <LoadingSpinner message="Loading messages…" />
                ) : messages.length === 0 ? (
                  <p className="text-sm text-surface-500 text-center py-8">No messages yet. Start the conversation.</p>
                ) : (
                  messages.map((msg) => {
                    const isAdminSide = msg.sender_id !== activeConv.member_id
                    return (
                      <div key={msg.id} className={`flex ${isAdminSide ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                          isAdminSide
                            ? 'bg-brand-600 text-white rounded-br-md'
                            : 'bg-white border border-surface-300 text-surface-800 rounded-bl-md'
                        }`}>
                          {!isAdminSide ? (
                            <p className="text-[10px] font-bold uppercase tracking-wide mb-1 opacity-70">
                              {msg.sender_name}
                            </p>
                          ) : null}
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                          <p className={`text-[10px] mt-1 ${isAdminSide ? 'text-brand-100' : 'text-surface-400'}`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={handleSend} className="border-t border-surface-300 p-4 bg-white flex gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                  placeholder="Message member as Happiness Exchange Admin…"
                  className="input flex-1 resize-none"
                />
                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  className="btn-primary px-4 self-end disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              {sendError ? <p className="px-4 pb-4 text-sm text-red-600">{sendError}</p> : null}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
