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

function idsMatch(a, b) {
  if (a == null || b == null || a === '' || b === '') return false
  return String(a) === String(b)
}

function isAdminPanelMessage(msg, { memberId, adminId } = {}) {
  if (msg?.message_source === 'admin_panel') return true
  if (msg?.message_source === 'member_reply') return false
  if (memberId && idsMatch(msg?.sender_id, memberId)) return false
  if (msg?.sender_role === 'admin') return true
  if (msg?.sender_role === 'user') {
    return isAdminSenderName(msg?.sender_name)
  }
  return isAdminSenderName(msg?.sender_name)
}

function isMemberReplyMessage(msg, { memberId } = {}) {
  if (msg?.message_source === 'member_reply') return true
  if (msg?.message_source === 'admin_panel') return false
  if (memberId && idsMatch(msg?.sender_id, memberId)) return true
  if (msg?.sender_role === 'user' && !isAdminSenderName(msg?.sender_name)) return true
  return false
}

export function inferSenderRole(msg, { memberId, adminId, currentUserId } = {}) {
  if (msg?.message_source === 'admin_panel') return 'admin'
  if (msg?.message_source === 'member_reply') return 'user'

  if (memberId && idsMatch(msg?.sender_id, memberId)) return 'user'

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

  if (idsMatch(senderId, memberId)) return 'user'
  if (idsMatch(senderId, adminId)) return 'admin'
  if (memberId && !idsMatch(senderId, memberId)) return 'admin'
  if (idsMatch(senderId, currentUserId)) return 'user'

  return 'unknown'
}

export function isOwnMessage(msg, { currentUserId, viewerRole = 'user', memberId, adminId } = {}) {
  if (viewerRole === 'admin') {
    return isAdminPanelMessage(msg, { memberId, adminId })
  }

  if (isMemberReplyMessage(msg, { memberId })) {
    return idsMatch(msg.sender_id, currentUserId)
  }

  if (isAdminPanelMessage(msg, { memberId, adminId })) return false

  const role = inferSenderRole(msg, { memberId, adminId, currentUserId })
  if (role === 'admin') return false
  return role === 'user' && idsMatch(msg?.sender_id, currentUserId)
}

export function messageSenderLabel(msg, { currentUserId, viewerRole = 'user', memberId, adminId } = {}) {
  if (viewerRole === 'admin') {
    if (isAdminPanelMessage(msg, { memberId, adminId })) return 'You'
    if (isMemberReplyMessage(msg, { memberId })) return msg?.sender_name || 'User'
    const role = inferSenderRole(msg, { memberId, adminId, currentUserId })
    if (role === 'admin') return 'You'
    if (role === 'user') return msg?.sender_name || 'User'
    return 'Unknown sender'
  }

  if (isAdminPanelMessage(msg, { memberId, adminId })) return ADMIN_SUPPORT_NAME
  if (isMemberReplyMessage(msg, { memberId })) {
    return idsMatch(msg?.sender_id, currentUserId) ? 'You' : (msg?.sender_name || 'User')
  }

  const role = inferSenderRole(msg, { memberId, adminId, currentUserId })
  if (role === 'admin') return ADMIN_SUPPORT_NAME
  if (idsMatch(msg?.sender_id, currentUserId)) return 'You'
  if (role === 'user') return msg?.sender_name || 'User'
  return 'Unknown sender'
}

export function isAdminMessage(msg, { memberId, adminId, currentUserId } = {}) {
  return isAdminPanelMessage(msg, { memberId, adminId }) || (
    !isMemberReplyMessage(msg, { memberId }) && inferSenderRole(msg, { memberId, adminId, currentUserId }) === 'admin'
  )
}
