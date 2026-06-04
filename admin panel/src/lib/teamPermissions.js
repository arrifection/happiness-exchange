import { ROLES } from './roles'

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MODERATOR]: 'Moderator',
  [ROLES.COURIER]: 'Courier',
}

export const INVITE_ROLES = [ROLES.ADMIN, ROLES.MODERATOR, ROLES.COURIER]

export function countSuperAdmins(members) {
  return members.filter((member) => member.role === ROLES.SUPER_ADMIN && !member.is_banned).length
}

export function isLastSuperAdmin(members, member) {
  return member?.role === ROLES.SUPER_ADMIN && countSuperAdmins(members) <= 1
}

export function canRemoveMember(members, currentUserId, member) {
  if (!member) return { ok: false, reason: 'Member not found.' }
  if (member.id === currentUserId) {
    return { ok: false, reason: 'You cannot remove yourself from the team.' }
  }
  if (isLastSuperAdmin(members, member)) {
    return { ok: false, reason: 'Cannot remove the last super admin.' }
  }
  return { ok: true }
}

export function canChangeRole(members, currentUserId, member, newRole) {
  if (!member) return { ok: false, reason: 'Member not found.' }
  if (member.id === currentUserId) {
    return { ok: false, reason: 'You cannot change your own role here.' }
  }
  if (newRole === ROLES.SUPER_ADMIN) {
    return { ok: false, reason: 'Promoting to super admin is not allowed from this panel.' }
  }
  if (member.role === ROLES.SUPER_ADMIN && newRole !== ROLES.SUPER_ADMIN && isLastSuperAdmin(members, member)) {
    return { ok: false, reason: 'Cannot remove the last super admin.' }
  }
  if (member.role === ROLES.SUPER_ADMIN) {
    return { ok: false, reason: 'Super admin roles cannot be changed here.' }
  }
  return { ok: true }
}

export function getInitials(name, email) {
  const source = String(name || email || 'A').trim()
  return source.charAt(0).toUpperCase()
}

export function formatTeamDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatTeamDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
