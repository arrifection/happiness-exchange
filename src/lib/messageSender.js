export const ADMIN_DISPLAY_NAME = 'Happiness Exchange Admin'

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

/** Admin-side message in an admin-mediated thread (trust message_source first). */
export function isAdminMessage(msg) {
  if (msg?.message_source === 'admin_panel') return true
  if (msg?.message_source === 'member_reply') return false
  if (msg?.sender_role === 'admin') return true
  if (msg?.sender_role === 'user') return false
  return isAdminSenderName(msg?.sender_name)
}

export function isOwnMessage(msg, { viewerRole = 'user' } = {}) {
  const admin = isAdminMessage(msg)
  if (viewerRole === 'admin') return admin
  return !admin
}

export function messageSenderLabel(msg, { viewerRole = 'user' } = {}) {
  const admin = isAdminMessage(msg)
  if (viewerRole === 'admin') {
    return admin ? 'You' : (msg?.sender_name || 'Member')
  }
  return admin ? ADMIN_DISPLAY_NAME : 'You'
}

export { resolveMemberId } from './staffRoles.js'
