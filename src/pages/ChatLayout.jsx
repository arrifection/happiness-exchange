import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

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

export default function ChatLayout({ apiBase, token, currentUser }) {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  const [conversations, setConversations] = useState([])
  const [loadingConv, setLoadingConv] = useState(true)

  const [messages, setMessages] = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState('')

  const [showOptions, setShowOptions] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  
  // Status check polling
  const [otherUserOnline, setOtherUserOnline] = useState(false)
  
  const activeConv = conversations.find(c => c.id === conversationId)
  const otherId = activeConv ? (activeConv.giver_id === currentUser?.id ? activeConv.receiver_id : activeConv.giver_id) : null
  const iBlockedThem = otherId && currentUser?.blocked_users?.includes(otherId)

  useEffect(() => {
    if (!token) return
    loadConversations()
    const interval = setInterval(loadConversations, 15000)
    return () => clearInterval(interval)
  }, [token])

  useEffect(() => {
    if (!conversationId || !token) {
      setMessages([])
      return
    }
    loadMessages()
    const interval = setInterval(loadMessages, 10000)
    return () => clearInterval(interval)
  }, [conversationId, token])

  // Polling for online status
  useEffect(() => {
    if (!activeConv || !token) return
    const checkStatus = async () => {
      const otherId = activeConv.giver_id === currentUser?.id ? activeConv.receiver_id : activeConv.giver_id
      try {
        const res = await fetch(`${apiBase}/api/users/${otherId}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (res.ok && data.last_online_at) {
          const lastOnline = new Date(data.last_online_at).getTime()
          const now = new Date().getTime()
          // Consider online if active in the last 2 minutes
          setOtherUserOnline(now - lastOnline < 120000)
        }
      } catch (err) { /* silent */ }
    }
    checkStatus()
    const intv = setInterval(checkStatus, 30000)
    return () => clearInterval(intv)
  }, [activeConv, token, apiBase])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [messages])

  async function loadConversations() {
    try {
      const res = await fetch(`${apiBase}/api/conversations/my`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setConversations(data)
    } catch { /* silent */ }
    finally { setLoadingConv(false) }
  }

  async function loadMessages() {
    try {
      const res = await fetch(`${apiBase}/api/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setMessages(data)
    } catch { /* silent */ }
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
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        alert("User blocked.")
        navigate('/messages')
      } else {
        const data = await res.json()
        alert(data.detail || 'Block failed.')
      }
    } catch {
      alert("Connection error.")
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
        alert("Chat reported to admins.")
        setReportModalOpen(false)
        setShowOptions(false)
      } else {
        alert("Failed to report.")
      }
    } catch {
      alert("Connection error.")
    }
  }

  const handleTyping = (e) => {
    setText(e.target.value)
    // Send typing status patch (throttled locally in future, simple call here if needed)
  }

  // Layout rendering
  const showSidebar = !conversationId || window.innerWidth >= 768
  const showChat = conversationId || window.innerWidth >= 768

  return (
    <div className="flex bg-white shadow-sm border-t border-[#efe8da] h-[calc(100vh-56px)] md:h-[calc(100vh-56px)] overflow-hidden">
      
      {/* Sidebar Inbox */}
      <div className={`flex flex-col border-r border-[#efe8da] w-full md:w-80 lg:w-96 shrink-0 bg-[#faf7f1]/30 ${showSidebar ? 'block' : 'hidden md:flex'}`}>
        <div className="p-4 border-b border-[#efe8da] bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold font-['Plus_Jakarta_Sans'] text-[#1f3328]">Messages</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loadingConv ? (
            <div className="flex justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#8b4cf6] border-t-transparent" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#8c755f]">
              No conversations yet.
            </div>
          ) : (
            <div className="divide-y divide-[#efe8da]">
              {conversations.map(c => {
                const otherName = c.giver_id === currentUser?.id ? c.receiver_name : c.giver_name
                const isActive = c.id === conversationId
                const unread = c.unread_count > 0
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/messages/${c.id}`)}
                    className={`w-full text-left p-4 flex items-center gap-3 transition-colors hover:bg-white/60 ${isActive ? 'bg-white shadow-sm border-l-2 border-l-[#8b4cf6]' : ''}`}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b4cf6] to-[#c084fc] text-sm font-bold text-white relative">
                      {getInitials(otherName)}
                      {unread && <span className="absolute top-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-red-500"></span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <p className={`truncate text-[14px] ${unread ? 'font-bold text-[#1f1f1f]' : 'font-semibold text-[#1f3328]'}`}>{otherName || 'Unknown'}</p>
                        <p className="text-[10px] text-[#68766d] ml-2 shrink-0">{c.last_message_at ? formatMsgTime(c.last_message_at) : ''}</p>
                      </div>
                      <p className={`truncate text-xs ${unread ? 'font-medium text-[#1f1f1f]' : 'text-[#8c755f]'}`}>
                        {c.last_message_text || <span className="italic">No messages</span>}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex flex-col flex-1 bg-white relative ${showChat ? 'flex' : 'hidden md:flex'}`}>
        {activeConv ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 border-b border-[#efe8da] bg-white px-4 py-3 shrink-0 z-20">
              <button
                onClick={() => navigate('/messages')}
                className="md:hidden flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#faf7f1]"
              >
                <svg className="h-5 w-5 text-[#8c755f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b4cf6] to-[#c084fc] text-[12px] font-bold text-white relative">
                {getInitials(activeConv.giver_id === currentUser?.id ? activeConv.receiver_name : activeConv.giver_name)}
                {otherUserOnline && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white bg-green-500"></span>}
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-[#1f3328]">
                    {activeConv.giver_id === currentUser?.id ? activeConv.receiver_name : activeConv.giver_name}
                  </p>
                  <div className="flex items-center gap-1 bg-[#efe7ff] text-[#8b4cf6] px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase">
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    Anon
                  </div>
                </div>
                {otherUserOnline && <p className="text-[10px] font-medium text-green-600">Online</p>}
              </div>

              {/* Options Menu */}
              <div className="relative">
                <button onClick={() => setShowOptions(!showOptions)} className="p-2 text-[#8c755f] hover:bg-[#faf7f1] rounded-full">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v.01M12 12v.01M12 18v.01" />
                  </svg>
                </button>
                {showOptions && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowOptions(false)} />
                    <div className="absolute right-0 top-10 w-48 bg-white border border-[#efe8da] shadow-lg rounded-xl overflow-hidden z-20">
                      <button onClick={handleBlock} className="w-full text-left px-4 py-3 text-sm text-[#c65d4a] hover:bg-[#fef2f2] font-semibold border-b border-[#efe8da]">
                        Block User
                      </button>
                      <button onClick={() => { setReportModalOpen(true); setShowOptions(false) }} className="w-full text-left px-4 py-3 text-sm text-[#1f3328] hover:bg-[#faf7f1] font-semibold">
                        Report Chat
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Item Preview Pinned Header */}
            <div className="bg-[#faf7f1]/50 border-b border-[#efe8da] px-4 py-2 flex items-center gap-3 shrink-0">
              <div className="h-10 w-10 rounded-lg bg-[#efe8da] flex items-center justify-center overflow-hidden shrink-0">
                <svg className="w-5 h-5 text-[#8c755f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold tracking-wider text-[#8b4cf6]">Exchanging</p>
                <p className="text-sm font-semibold text-[#1f3328] truncate">{activeConv.item_title}</p>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-[#faf7f1]/20">
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === currentUser?.id
                const showSep = shouldShowDateSeparator(messages, i)
                return (
                  <div key={msg.id}>
                    {showSep && (
                      <div className="flex items-center gap-3 py-4">
                        <div className="h-px flex-1 bg-[#efe8da]" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/60">
                          {formatDateSeparator(msg.created_at)}
                        </span>
                        <div className="h-px flex-1 bg-[#efe8da]" />
                      </div>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                      <div className={`group max-w-[75%] md:max-w-[60%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`rounded-2xl text-[14px] leading-relaxed shadow-sm overflow-hidden ${
                            isMe ? 'rounded-br-sm bg-[#8b4cf6] text-white' : 'rounded-bl-sm bg-white text-[#1f3328] border border-[#efe8da]'
                          }`}
                        >
                          {msg.message_type === 'image' && msg.image_url ? (
                            <img src={msg.image_url} alt="Shared" className="w-full max-w-sm h-auto object-cover max-h-64 cursor-pointer hover:opacity-95" />
                          ) : (
                            <div className="px-4 py-2.5 whitespace-pre-wrap">{msg.text}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1 px-1">
                          <span className="text-[10px] text-[#8c755f]/60">{formatMsgTime(msg.created_at)}</span>
                          {isMe && (
                            <svg className={`w-3.5 h-3.5 ${msg.read ? 'text-blue-500' : 'text-[#8c755f]/40'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {error && <p className="text-center text-[11px] font-medium text-[#c65d4a] my-2">{error}</p>}
              <div ref={bottomRef} className="h-2" />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="bg-white border-t border-[#efe8da] px-4 py-3 flex items-end gap-2 pb-safe shrink-0">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
              
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || !currentUser?.is_verified || iBlockedThem}
                className="flex shrink-0 h-11 w-11 items-center justify-center rounded-full text-[#8c755f] hover:bg-[#faf7f1] hover:text-[#8b4cf6] transition-colors disabled:opacity-50"
              >
                {uploadingImage ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#8b4cf6] border-t-transparent" />
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                )}
              </button>

              <div className="flex-1 bg-[#faf7f1] border border-[#efe8da] rounded-2xl flex items-end px-4 py-2 focus-within:border-[#8b4cf6] focus-within:ring-2 focus-within:ring-[#8b4cf6]/10 transition-all">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={handleTyping}
                  disabled={!currentUser?.is_verified || iBlockedThem}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend(e)
                    }
                  }}
                  placeholder={iBlockedThem ? "You blocked this user." : (currentUser?.is_verified ? "Type a message…" : "Verify email to chat")}
                  rows={1}
                  className="w-full resize-none bg-transparent text-sm text-[#1f3328] outline-none placeholder-[#8c755f]/50 disabled:opacity-60 max-h-32"
                  style={{ minHeight: '24px' }}
                />
              </div>

              <button
                type="submit"
                disabled={!text.trim() || sending || !currentUser?.is_verified || iBlockedThem}
                className="flex shrink-0 h-11 w-11 items-center justify-center rounded-full bg-[#8b4cf6] text-white shadow-sm transition-all hover:bg-[#7b40e6] active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-5 w-5 -mt-0.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" /></svg>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#faf7f1]/30">
            <div className="h-16 w-16 bg-[#efe7ff] rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-[#8b4cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#1f3328]">Your Messages</h3>
            <p className="text-sm text-[#8c755f] mt-2 max-w-sm">Select a conversation from the sidebar to view messages or send a new one.</p>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-in">
            <div className="p-4 border-b border-[#efe8da]">
              <h3 className="font-bold text-[#1f3328]">Report Conversation</h3>
            </div>
            <form onSubmit={handleReport} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#8c755f] mb-1">Reason for reporting</label>
                <select 
                  value={reportReason} 
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-[#faf7f1] border border-[#efe8da] rounded-xl px-3 py-2 text-sm focus:border-[#8b4cf6] outline-none"
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
                <button type="button" onClick={() => setReportModalOpen(false)} className="px-4 py-2 text-sm font-bold text-[#8c755f] hover:bg-[#faf7f1] rounded-full transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={!reportReason} className="px-4 py-2 text-sm font-bold bg-[#c65d4a] text-white rounded-full hover:bg-[#b05241] transition-colors disabled:opacity-50">
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
