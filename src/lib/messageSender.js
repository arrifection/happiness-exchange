export const ADMIN_SUPPORT_NAME = 'Happiness Exchange Support'

const ADMIN_SENDER_NAME_MARKERS = new Set([
  'happiness exchange admin',
  'happiness exchange support',
])

export function isAdminSenderName(name) {
  const normalized = (name || '').trim().toLowerCase()
  if (!normalized) return false
  if (ADMIN_SENDER_NAME_MARKERS.has(normalized)) return true
  return normalized.startsWith('happiness exchange admin')
}

export function inferSenderRole(msg) {
  if (msg?.message_source === 'admin_panel') return 'admin'
  if (msg?.message_source === 'member_reply') return 'user'
  if (msg?.sender_role === 'admin') return 'admin'
  if (msg?.sender_role === 'user') return 'user'
  if (isAdminSenderName(msg?.sender_name)) return 'admin'
  return 'unknown'
}

export function isOwnMessage(msg, { viewerRole = 'user' } = {}) {
  const role = inferSenderRole(msg)
  if (viewerRole === 'admin') {
    return role === 'admin'
  }
  return role === 'user'
}

export function messageSenderLabel(msg, { viewerRole = 'user' } = {}) {
  const role = inferSenderRole(msg)
  if (viewerRole === 'admin') {
    return role === 'admin' ? 'You' : (msg?.sender_name || 'Member')
  }
  return role === 'admin' ? ADMIN_SUPPORT_NAME : 'You'
}

export function isAdminMessage(msg) {
  return inferSenderRole(msg) === 'admin'
}

export function resolveMemberId(conversation, currentUserId) {
  if (conversation?.member_id) return String(conversation.member_id)
  if (conversation?.chat_type && currentUserId) return String(currentUserId)
  return undefined
}
