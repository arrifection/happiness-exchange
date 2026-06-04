export const ADMIN_VIEWER_ROLES = ['admin', 'super_admin', 'moderator']

export function normalizeRole(role) {
  return (role || '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
}

export function isStaffViewerRole(role) {
  return ADMIN_VIEWER_ROLES.includes(normalizeRole(role))
}

export function resolveMemberId(conversation, currentUserId) {
  if (conversation?.member_id) return String(conversation.member_id)
  if (conversation?.chat_type && currentUserId) return String(currentUserId)
  return undefined
}

export function isConversationMember(currentUserId, conversation) {
  const memberId = resolveMemberId(conversation, currentUserId)
  if (!memberId || !currentUserId) return false
  return String(currentUserId) === String(memberId)
}

/** Member view when you ARE the chat member; admin view when staff browses others' threads. */
export function resolveViewerRole(currentUser, conversation) {
  if (isConversationMember(currentUser?.id, conversation)) return 'user'
  if (isStaffViewerRole(currentUser?.role)) return 'admin'
  return 'user'
}

export function canReplyInConversation(currentUser, conversation) {
  return isConversationMember(currentUser?.id, conversation)
}
