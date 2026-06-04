import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  MessageSquare, Send, RefreshCw, Package, User, Wrench, Search, Filter,
} from 'lucide-react'

import { adminConversationsApi, conversationsApi } from '../lib/api'
import { isAdminMessage, messageSenderLabel } from '../lib/messageSender'
import { resolveApiError } from '../lib/backend'
import { buildMessagesUrl, chatConversationId } from '../lib/messagesNavigation'
import { EmptyState, ErrorState, LoadingSpinner } from '../components/States'

const CHAT_FILTERS = [
  { value: 'all', label: 'All chats' },
  { value: 'receiver', label: 'Receiver chats' },
  { value: 'lister', label: 'Lister chats' },
  { value: 'unread', label: 'Unread' },
]

const STATUS_FILTERS = [
  { value: '', label: 'Approved + completed' },
  { value: 'approved', label: 'Approved only' },
  { value: 'completed', label: 'Completed only' },
]

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ChatPreview({ label, chat, onOpen, active, disabled }) {
  if (!chat) {
    return (
      <div className="rounded-lg border border-dashed border-surface-300 bg-surface-50 p-3 text-xs text-surface-500">
        {label}: chat missing — use Repair chats.
      </div>
    )
  }

  return (
    <div className={`rounded-lg border p-3 ${active ? 'border-brand-300 bg-brand-50/60' : 'border-surface-300 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">{label}</p>
          <p className="text-sm font-medium text-surface-800 truncate">{chat.member_name || 'Member'}</p>
          <p className="text-xs text-surface-500 truncate">{chat.last_message_text || 'No messages yet'}</p>
        </div>
        {chat.unread_count > 0 ? (
          <span className="badge-red shrink-0">{chat.unread_count}</span>
        ) : null}
      </div>
      <button
        type="button"
        className="btn-secondary mt-3 w-full py-1.5 text-xs"
        disabled={disabled}
        onClick={onOpen}
      >
        Open {label}
      </button>
    </div>
  )
}

export default function MessagesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const bottomRef = useRef(null)

  const selectedRequestId = searchParams.get('requestId') || ''
  const activeChatSide = searchParams.get('chat') === 'lister' ? 'lister' : 'receiver'

  const [exchanges, setExchanges] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState('')
  const [search, setSearch] = useState('')
  const [chatFilter, setChatFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [repairingId, setRepairingId] = useState('')

  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendError, setSendError] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const selectedExchange = useMemo(
    () => exchanges.find((ex) => ex.request_id === selectedRequestId) || null,
    [exchanges, selectedRequestId],
  )

  const activeConversationId = chatConversationId(selectedExchange, activeChatSide)
  const activeChat = activeChatSide === 'lister'
    ? selectedExchange?.lister_chat
    : selectedExchange?.receiver_chat

  const loadExchanges = useCallback(async () => {
    setListError('')
    try {
      const params = {
        limit: 100,
        repair_missing: true,
      }
      if (search.trim()) params.search = search.trim()
      if (statusFilter) params.status = statusFilter
      if (chatFilter !== 'all') params.chat_filter = chatFilter

      const res = await adminConversationsApi.listExchanges(params)
      setExchanges(res.data?.exchanges || [])
    } catch (err) {
      setListError(resolveApiError(err))
    } finally {
      setLoadingList(false)
    }
  }, [search, chatFilter, statusFilter])

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([])
      return
    }
    setLoadingMessages(true)
    setSendError('')
    try {
      const res = await conversationsApi.messages(conversationId)
      setMessages(res.data || [])
    } catch (err) {
      setSendError(resolveApiError(err))
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    loadExchanges()
    const interval = window.setInterval(loadExchanges, 15000)
    return () => window.clearInterval(interval)
  }, [loadExchanges])

  useEffect(() => {
    loadMessages(activeConversationId)
    if (!activeConversationId) return undefined
    const interval = window.setInterval(() => loadMessages(activeConversationId), 10000)
    return () => window.clearInterval(interval)
  }, [activeConversationId, loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function selectExchange(requestId, chat = 'receiver') {
    navigate(buildMessagesUrl({ requestId, chat }))
  }

  function selectChatSide(chat) {
    if (!selectedRequestId) return
    setSearchParams({ requestId: selectedRequestId, chat })
  }

  async function handleRepair(requestId) {
    setRepairingId(requestId)
    try {
      await adminConversationsApi.repair(requestId)
      await loadExchanges()
    } catch (err) {
      setListError(resolveApiError(err, 'Could not repair chats.'))
    } finally {
      setRepairingId('')
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !activeConversationId || sending) return

    setSending(true)
    setSendError('')
    try {
      const res = await adminConversationsApi.sendMessage(activeConversationId, {
        text: trimmed,
        message_type: 'text',
      })
      setMessages((prev) => [...prev, res.data])
      setText('')
      await loadExchanges()
    } catch (err) {
      setSendError(resolveApiError(err))
    } finally {
      setSending(false)
    }
  }

  if (loadingList) return <LoadingSpinner message="Loading mediated exchanges…" />

  return (
    <div className="animate-slide-in">
      <div className="page-header flex items-start justify-between gap-4">
        <div>
          <h2 className="page-title">Messages</h2>
          <p className="page-subtitle">
            Admin-mediated coordination — separate chats with receiver and lister (no direct member messaging).
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={loadExchanges}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {listError ? <div className="mb-4"><ErrorState message={listError} onRetry={loadExchanges} /></div> : null}

      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item, people, request id, messages…"
              className="form-input pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-surface-500" />
            <select className="form-select w-40" value={chatFilter} onChange={(e) => setChatFilter(e.target.value)}>
              {CHAT_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select className="form-select w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_FILTERS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4 min-h-[680px]">
        <aside className="card p-0 overflow-hidden flex flex-col max-h-[780px]">
          <div className="px-4 py-3 border-b border-surface-300 bg-surface-100/70">
            <p className="text-sm font-semibold text-surface-800">Approved exchanges</p>
            <p className="text-xs text-surface-500">{exchanges.length} shown</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {exchanges.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No mediated exchanges yet"
                description="Approved or completed requests appear here with separate admin chats."
              />
            ) : (
              exchanges.map((exchange) => {
                const isSelected = exchange.request_id === selectedRequestId
                return (
                  <button
                    key={exchange.request_id}
                    type="button"
                    onClick={() => selectExchange(exchange.request_id, 'receiver')}
                    className={`w-full text-left px-4 py-4 border-b border-surface-200 transition-colors ${
                      isSelected ? 'bg-brand-50 border-l-4 border-l-brand-500' : 'hover:bg-lavender-50'
                    }`}
                  >
                    <div className="flex gap-3">
                      {exchange.item_image_url ? (
                        <img
                          src={exchange.item_image_url}
                          alt={exchange.item_title}
                          className="w-12 h-12 rounded-lg object-cover border border-surface-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-surface-100 border border-surface-200 flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-surface-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-surface-800 truncate">{exchange.item_title}</p>
                        <span className={`badge ${exchange.request_status === 'completed' ? 'badge-green' : 'badge-blue'} mt-1`}>
                          {exchange.request_status}
                        </span>
                        <p className="text-xs text-surface-500 mt-1 truncate">
                          Receiver: {exchange.requester_name}
                        </p>
                        <p className="text-xs text-surface-500 truncate">
                          Lister: {exchange.owner_name}
                        </p>
                        {exchange.total_unread > 0 ? (
                          <span className="badge-red mt-2">{exchange.total_unread} unread</span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <section className="card p-0 overflow-hidden flex flex-col min-h-[680px]">
          {!selectedExchange ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div>
                <MessageSquare className="w-10 h-10 text-surface-400 mx-auto" />
                <h3 className="mt-4 text-lg font-semibold text-surface-800">Select an exchange</h3>
                <p className="mt-2 text-sm text-surface-500 max-w-md">
                  Choose an approved request to message the receiver and lister separately.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col xl:flex-row flex-1 min-h-0">
              <div className="xl:w-[340px] border-b xl:border-b-0 xl:border-r border-surface-300 p-5 space-y-4 overflow-y-auto">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">Exchange</p>
                  <div className="mt-2 flex gap-3">
                    {selectedExchange.item_image_url ? (
                      <img
                        src={selectedExchange.item_image_url}
                        alt={selectedExchange.item_title}
                        className="w-16 h-16 rounded-xl object-cover border border-surface-200"
                      />
                    ) : null}
                    <div>
                      <p className="font-semibold text-surface-800">{selectedExchange.item_title}</p>
                      <p className="text-xs text-surface-500 mt-1">Request {selectedExchange.request_id}</p>
                      <span className={`badge ${selectedExchange.request_status === 'completed' ? 'badge-green' : 'badge-blue'} mt-1`}>
                        {selectedExchange.request_status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="rounded-lg border border-surface-300 p-3">
                    <p className="text-xs font-semibold text-surface-500 flex items-center gap-1"><User className="w-3 h-3" /> Receiver</p>
                    <p className="font-medium text-surface-800">{selectedExchange.requester_name}</p>
                    <p className="text-xs text-surface-500 break-all">{selectedExchange.requester_email}</p>
                  </div>
                  <div className="rounded-lg border border-surface-300 p-3">
                    <p className="text-xs font-semibold text-surface-500 flex items-center gap-1"><User className="w-3 h-3" /> Lister</p>
                    <p className="font-medium text-surface-800">{selectedExchange.owner_name}</p>
                    <p className="text-xs text-surface-500 break-all">{selectedExchange.owner_email}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">Reason</p>
                  <p className="text-sm text-surface-700 mt-1 whitespace-pre-wrap">
                    {selectedExchange.reason || 'No reason provided.'}
                  </p>
                </div>

                <p className="text-xs text-surface-500">
                  Approved {formatDate(selectedExchange.approved_at || selectedExchange.created_at)}
                </p>

                {selectedExchange.needs_repair ? (
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    disabled={repairingId === selectedExchange.request_id}
                    onClick={() => handleRepair(selectedExchange.request_id)}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    {repairingId === selectedExchange.request_id ? 'Repairing…' : 'Repair Admin Chats'}
                  </button>
                ) : null}

                <ChatPreview
                  label="Admin ↔ Receiver"
                  chat={selectedExchange.receiver_chat}
                  active={activeChatSide === 'receiver'}
                  disabled={!selectedExchange.receiver_chat}
                  onOpen={() => selectChatSide('receiver')}
                />
                <ChatPreview
                  label="Admin ↔ Lister"
                  chat={selectedExchange.lister_chat}
                  active={activeChatSide === 'lister'}
                  disabled={!selectedExchange.lister_chat}
                  onOpen={() => selectChatSide('lister')}
                />
              </div>

              <div className="flex-1 flex flex-col min-h-[420px]">
                <div className="px-5 py-4 border-b border-surface-300 bg-white">
                  <p className="text-sm font-semibold text-surface-800">
                    {activeChatSide === 'lister' ? 'Admin ↔ Lister' : 'Admin ↔ Receiver'}
                  </p>
                  <p className="text-xs text-surface-500 mt-1">
                    Messaging {activeChat?.member_name || 'member'} — messages stay in this thread only.
                  </p>
                </div>

                {!activeConversationId ? (
                  <div className="flex-1 flex items-center justify-center p-6 text-sm text-surface-500">
                    Chat unavailable. Use Repair Admin Chats.
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-surface-100">
                      {loadingMessages ? (
                        <LoadingSpinner message="Loading messages…" />
                      ) : messages.length === 0 ? (
                        <p className="text-sm text-surface-500 text-center py-8">No messages yet. Start the conversation.</p>
                      ) : (
                        messages.map((msg) => {
                          const identityContext = {
                            currentUserId: undefined,
                            memberId: activeChat?.member_id,
                            adminId: activeChat?.admin_id,
                          }
                          const isAdminSide = isAdminMessage(msg, identityContext)
                          const senderLabel = messageSenderLabel(msg, {
                            ...identityContext,
                            viewerRole: 'admin',
                          })
                          return (
                            <div key={msg.id} className={`flex ${isAdminSide ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                                isAdminSide
                                  ? 'bg-brand-600 text-white rounded-br-md'
                                  : 'bg-white border border-surface-300 text-surface-800 rounded-bl-md'
                              }`}>
                                {!isAdminSide ? (
                                  <p className="text-[10px] font-bold uppercase tracking-wide mb-1 opacity-70">
                                    {senderLabel}
                                  </p>
                                ) : (
                                  <p className="text-[10px] font-bold uppercase tracking-wide mb-1 text-brand-100">
                                    {senderLabel}
                                  </p>
                                )}
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
                        placeholder={
                          activeChatSide === 'lister'
                            ? 'Message the lister as Happiness Exchange Admin…'
                            : 'Message the receiver as Happiness Exchange Admin…'
                        }
                        className="form-input flex-1 resize-none"
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
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
