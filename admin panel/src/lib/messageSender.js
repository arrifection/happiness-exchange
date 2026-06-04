export const ADMIN_SUPPORT_NAME = 'Happiness Exchange Support'

export function inferSenderRole(msg, { memberId, adminId, currentUserId } = {}) {
  if (msg?.sender_role === 'admin' || msg?.sender_role === 'user') {
    return msg.sender_role
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
  const role = inferSenderRole(msg, { memberId, adminId, currentUserId })
  if (viewerRole === 'admin') return role === 'admin'
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
