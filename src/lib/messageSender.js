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

export function inferSenderRole(msg, { memberId, adminId, currentUserId } = {}) {
  if (msg?.sender_role === 'admin') return 'admin'
  if (msg?.sender_role === 'user') {
    if (isAdminSenderName(msg?.sender_name)) return 'admin'
    return 'user'
  }

  if (isAdminSenderName(msg?.sender_name)) {
    return 'admin'
  }

  const senderId = msg?.sender_id
  if (!senderId) return 'unknown'

  if (memberId && senderId === memberId) return 'user'
  if (adminId && senderId === adminId) return 'admin'
  if (memberId && senderId !== memberId) return 'admin'
  if (currentUserId && senderId === currentUserId) return 'user'

  return 'unknown'
}

export function isOwnMessage(msg, { currentUserId, viewerRole = 'user', memberId, adminId } = {}) {
  if (msg?.sender_role === 'admin') return false
  if (isAdminSenderName(msg?.sender_name)) return false

  const role = inferSenderRole(msg, { memberId, adminId, currentUserId })

  if (viewerRole === 'admin') return role === 'admin'

  if (role === 'admin') return false
  if (memberId && msg?.sender_id && msg.sender_id !== memberId) return false
  return role === 'user' && msg?.sender_id === currentUserId
}

export function messageSenderLabel(msg, { currentUserId, viewerRole = 'user', memberId, adminId } = {}) {
  const role = inferSenderRole(msg, { memberId, adminId, currentUserId })

  if (viewerRole === 'admin') {
    if (role === 'admin') return 'You'
    if (role === 'user') return msg?.sender_name || 'User'
    return 'Unknown sender'
  }

  if (role === 'admin') return ADMIN_SUPPORT_NAME
  if (msg?.sender_id === currentUserId) return 'You'
  if (role === 'user') return msg?.sender_name || 'User'
  return 'Unknown sender'
}

export function isAdminMessage(msg, { memberId, adminId, currentUserId } = {}) {
  return inferSenderRole(msg, { memberId, adminId, currentUserId }) === 'admin'
}
