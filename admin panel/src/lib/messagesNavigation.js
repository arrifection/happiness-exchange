export function buildMessagesUrl({ requestId, chat, conversationId } = {}) {
  const params = new URLSearchParams()
  if (requestId) params.set('requestId', requestId)
  if (chat) params.set('chat', chat)
  if (conversationId) params.set('conversationId', conversationId)
  const query = params.toString()
  return query ? `/messages?${query}` : '/messages'
}

export function chatConversationId(exchange, chatSide) {
  if (!exchange) return ''
  if (chatSide === 'lister') return exchange.lister_chat?.id || ''
  return exchange.receiver_chat?.id || ''
}

export const MEDIATED_REQUEST_STATUSES = new Set(['approved', 'completed'])

export function canOpenMediatedChat(status) {
  return MEDIATED_REQUEST_STATUSES.has(String(status || '').toLowerCase())
}
