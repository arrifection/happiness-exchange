import { useEffect, useMemo, useState } from 'react'
import {
  UsersRound, Plus, Mail, Shield, RefreshCw, Search, Filter,
  MoreVertical, Eye, UserCog, UserMinus, X, Clock, CalendarDays, Copy, Check,
} from 'lucide-react'

import { ROLES, useAuth } from '../contexts/AuthContext'
import { teamApi } from '../lib/api'
import { resolveApiError } from '../lib/backend'
import ConfirmDialog from '../components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingSpinner } from '../components/States'
import {
  ROLE_LABELS,
  INVITE_ROLES,
  canRemoveMember,
  canChangeRole,
  getInitials,
  formatTeamDate,
  formatTeamDateTime,
  isLastSuperAdmin,
} from '../lib/teamPermissions'

const roleColors = {
  super_admin: 'badge-purple',
  admin: 'badge-blue',
  moderator: 'badge-yellow',
  courier: 'badge-green',
}

const roleGradients = {
  super_admin: 'from-purple-600 to-pink-600',
  admin: 'from-brand-600 to-brand-700',
  moderator: 'from-amber-600 to-orange-600',
  courier: 'from-emerald-600 to-teal-600',
}

const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: ROLES.SUPER_ADMIN, label: 'Super Admin' },
  { value: ROLES.ADMIN, label: 'Admin' },
  { value: ROLES.MODERATOR, label: 'Moderator' },
  { value: ROLES.COURIER, label: 'Courier' },
]

function Toast({ message, tone = 'success' }) {
  if (!message) return null
  const classes = tone === 'error'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${classes}`}>
      {message}
    </div>
  )
}

function TeamMemberCard({
  member,
  members,
  currentUserId,
  menuOpen,
  onToggleMenu,
  onView,
  onChangeRole,
  onRemove,
}) {
  const name = member.name || member.full_name || member.email
  const isSelf = member.id === currentUserId
  const protectedSuper = isLastSuperAdmin(members, member)
  const removeCheck = canRemoveMember(members, currentUserId, member)
  const canManage = !isSelf && member.role !== ROLES.SUPER_ADMIN

  return (
    <div className="card hover:border-brand-200 transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${roleGradients[member.role] || 'from-brand-600 to-brand-700'} flex items-center justify-center text-white text-lg font-bold shadow-soft shrink-0`}>
            {getInitials(name, member.email)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-surface-800 truncate">{name}</p>
              {isSelf ? <span className="badge badge-blue">You</span> : null}
              {protectedSuper ? <span className="badge badge-purple">Protected</span> : null}
            </div>
            <span className={`badge mt-1 ${roleColors[member.role] || 'badge-gray'}`}>
              <Shield className="w-2.5 h-2.5" />
              {ROLE_LABELS[member.role] || member.role?.replace('_', ' ')}
            </span>
          </div>
        </div>

        {canManage ? (
          <div className="relative shrink-0">
            <button
              type="button"
              className="btn-icon btn-ghost"
              aria-label="Member actions"
              onClick={() => onToggleMenu(member.id)}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen === member.id ? (
              <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-surface-300 bg-white py-1 shadow-card-hover">
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-lavender-50" onClick={() => onView(member)}>
                  <Eye className="w-3.5 h-3.5" /> View details
                </button>
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-lavender-50" onClick={() => onChangeRole(member)}>
                  <UserCog className="w-3.5 h-3.5" /> Change role
                </button>
                <button
                  type="button"
                  disabled={!removeCheck.ok}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
                  onClick={() => onRemove(member)}
                >
                  <UserMinus className="w-3.5 h-3.5" /> Remove access
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-surface-600">
          <Mail className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{member.email}</span>
        </div>
        <div className="flex items-center gap-2 text-surface-500 text-xs">
          <CalendarDays className="w-3 h-3 shrink-0" />
          Joined {formatTeamDate(member.created_at)}
        </div>
        <div className="flex items-center gap-2 text-surface-500 text-xs">
          <Clock className="w-3 h-3 shrink-0" />
          Last login {formatTeamDateTime(member.last_login_at)}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`badge ${
            member.status === 'suspended'
              ? 'badge-red'
              : member.status === 'pending'
                ? 'badge-yellow'
                : 'badge-green'
          }`}>
            {member.status === 'suspended'
              ? 'Suspended'
              : member.status === 'pending'
                ? 'Pending invite'
                : 'Active'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function TeamPage() {
  const { user, isSuperAdmin } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState('')
  const [toastTone, setToastTone] = useState('success')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [menuOpen, setMenuOpen] = useState('')

  const [showInvite, setShowInvite] = useState(false)
  const [invite, setInvite] = useState({ name: '', email: '', role: ROLES.MODERATOR })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)
  const [copiedInviteLink, setCopiedInviteLink] = useState(false)

  const [detailMember, setDetailMember] = useState(null)
  const [roleMember, setRoleMember] = useState(null)
  const [newRole, setNewRole] = useState(ROLES.MODERATOR)
  const [roleLoading, setRoleLoading] = useState(false)

  const [removeMember, setRemoveMember] = useState(null)
  const [removeLoading, setRemoveLoading] = useState(false)

  const showMessage = (message, tone = 'success') => {
    setToast(message)
    setToastTone(tone)
    window.setTimeout(() => setToast(''), 5000)
  }

  const loadTeam = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await teamApi.list()
      setMembers(res.data.members || [])
    } catch (err) {
      setError(resolveApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTeam() }, [])

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return members.filter((member) => {
      if (roleFilter !== 'all' && member.role !== roleFilter) return false
      if (!query) return true
      return [
        member.name,
        member.email,
        member.role,
        ROLE_LABELS[member.role],
      ].some((value) => String(value || '').toLowerCase().includes(query))
    })
  }, [members, search, roleFilter])

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviteLoading(true)
    setInviteResult(null)
    setCopiedInviteLink(false)
    try {
      const res = await teamApi.invite(invite)
      const data = res.data || {}

      if (data.email_sent) {
        setShowInvite(false)
        setInvite({ name: '', email: '', role: ROLES.MODERATOR })
        setInviteResult(null)
        showMessage('Invite sent successfully.', 'success')
      } else if (data.invite_link) {
        setInviteResult({
          message: data.message || 'Invite created, but email sending is not configured. Copy invite link manually.',
          inviteLink: data.invite_link,
        })
        showMessage(data.message, data.email_error ? 'error' : 'success')
      } else {
        setShowInvite(false)
        setInvite({ name: '', email: '', role: ROLES.MODERATOR })
        showMessage(data.message || 'Team member access updated.', data.email_error ? 'error' : 'success')
      }
      await loadTeam()
    } catch (err) {
      showMessage(resolveApiError(err), 'error')
    } finally {
      setInviteLoading(false)
    }
  }

  const copyInviteLink = async (link) => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopiedInviteLink(true)
      window.setTimeout(() => setCopiedInviteLink(false), 2000)
    } catch {
      showMessage('Could not copy link. Select and copy it manually.', 'error')
    }
  }

  const closeInviteModal = () => {
    setShowInvite(false)
    setInviteResult(null)
    setCopiedInviteLink(false)
    setInvite({ name: '', email: '', role: ROLES.MODERATOR })
  }

  const handleChangeRole = async () => {
    if (!roleMember) return
    const check = canChangeRole(members, user?.id, roleMember, newRole)
    if (!check.ok) {
      showMessage(check.reason, 'error')
      return
    }

    setRoleLoading(true)
    try {
      const res = await teamApi.changeRole(roleMember.id, newRole)
      setRoleMember(null)
      showMessage(res.data?.message || 'Role updated.')
      await loadTeam()
    } catch (err) {
      showMessage(resolveApiError(err), 'error')
    } finally {
      setRoleLoading(false)
    }
  }

  const handleRemove = async () => {
    if (!removeMember) return
    const check = canRemoveMember(members, user?.id, removeMember)
    if (!check.ok) {
      showMessage(check.reason, 'error')
      setRemoveMember(null)
      return
    }

    setRemoveLoading(true)
    try {
      const res = await teamApi.remove(removeMember.id)
      setRemoveMember(null)
      showMessage(res.data?.message || 'Admin access removed.')
      await loadTeam()
    } catch (err) {
      showMessage(resolveApiError(err), 'error')
    } finally {
      setRemoveLoading(false)
    }
  }

  if (loading) return <LoadingSpinner message="Loading team…" />
  if (error) return <ErrorState message={error} onRetry={loadTeam} />

  return (
    <div className="animate-slide-in" onClick={() => setMenuOpen('')}>
      <div className="page-header flex items-start justify-between gap-4">
        <div>
          <h2 className="page-title">Team Members</h2>
          <p className="page-subtitle">
            {members.length} staff member{members.length === 1 ? '' : 's'} · super admins manage roles and access
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={loadTeam} className="btn-secondary">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {isSuperAdmin() ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); setInviteResult(null); setShowInvite(true) }} className="btn-primary">
              <Plus className="w-4 h-4" />
              Invite Member
            </button>
          ) : null}
        </div>
      </div>

      <Toast message={toast} tone={toastTone} />

      <div className="card mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="form-input pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-surface-500" />
            <select className="form-select w-40" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              {ROLE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredMembers.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No team members found"
          description={members.length === 0
            ? 'Invite your first moderator, admin, or courier when ready.'
            : 'Try adjusting your search or role filter.'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredMembers.map((member) => (
            <div key={member.id} onClick={(e) => e.stopPropagation()}>
              <TeamMemberCard
                member={member}
                members={members}
                currentUserId={user?.id}
                menuOpen={menuOpen}
                onToggleMenu={setMenuOpen}
                onView={setDetailMember}
                onChangeRole={(target) => {
                  setMenuOpen('')
                  setRoleMember(target)
                  setNewRole(target.role === ROLES.SUPER_ADMIN ? ROLES.ADMIN : target.role)
                }}
                onRemove={(target) => {
                  setMenuOpen('')
                  setRemoveMember(target)
                }}
              />
            </div>
          ))}
        </div>
      )}

      {showInvite ? (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md shadow-card animate-slide-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-surface-800">Invite Team Member</h3>
              <button type="button" className="btn-icon btn-ghost" onClick={closeInviteModal}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {inviteResult ? (
              <div className="space-y-4">
                <div className={`rounded-lg border px-4 py-3 text-sm ${inviteResult.inviteLink ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                  {inviteResult.message}
                </div>
                {inviteResult.inviteLink ? (
                  <div className="space-y-2">
                    <label className="form-label">Invite link</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        className="form-input text-xs"
                        value={inviteResult.inviteLink}
                      />
                      <button
                        type="button"
                        className="btn-secondary shrink-0"
                        onClick={() => copyInviteLink(inviteResult.inviteLink)}
                      >
                        {copiedInviteLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiedInviteLink ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-xs text-surface-500">
                      Share this link so they can set a password and sign in to the admin panel.
                    </p>
                  </div>
                ) : null}
                <button type="button" className="btn-primary w-full justify-center" onClick={closeInviteModal}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-surface-500 mb-4">
                  Enter their name and email. They will receive a link to set their admin password. Status stays pending until they accept.
                </p>
                <form onSubmit={handleInvite} className="space-y-4">
                  <div>
                    <label className="form-label">Full name</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      className="form-input"
                      placeholder="Jane Admin"
                      value={invite.name}
                      onChange={(e) => setInvite((current) => ({ ...current, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Email address</label>
                    <input
                      type="email"
                      required
                      className="form-input"
                      placeholder="colleague@company.com"
                      value={invite.email}
                      onChange={(e) => setInvite((current) => ({ ...current, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Role</label>
                    <select
                      className="form-select"
                      value={invite.role}
                      onChange={(e) => setInvite((current) => ({ ...current, role: e.target.value }))}
                    >
                      {INVITE_ROLES.map((role) => (
                        <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={inviteLoading} className="btn-primary flex-1 justify-center">
                      {inviteLoading ? 'Sending invite…' : 'Send invite'}
                    </button>
                    <button type="button" onClick={closeInviteModal} className="btn-secondary flex-1 justify-center">
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}

      {detailMember ? (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg shadow-card animate-slide-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-surface-800">Team member details</h3>
              <button type="button" className="btn-icon btn-ghost" onClick={() => setDetailMember(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-surface-500">Name</dt><dd className="font-medium text-surface-800">{detailMember.name}</dd></div>
              <div><dt className="text-surface-500">Email</dt><dd className="font-medium text-surface-800 break-all">{detailMember.email}</dd></div>
              <div><dt className="text-surface-500">Role</dt><dd><span className={`badge ${roleColors[detailMember.role] || 'badge-gray'}`}>{ROLE_LABELS[detailMember.role]}</span></dd></div>
              <div><dt className="text-surface-500">Status</dt><dd>{
                detailMember.status === 'pending'
                  ? 'Pending invite — waiting for password setup'
                  : detailMember.status === 'suspended'
                    ? 'Suspended'
                    : 'Active'
              }</dd></div>
              <div><dt className="text-surface-500">Joined</dt><dd>{formatTeamDate(detailMember.created_at)}</dd></div>
              <div><dt className="text-surface-500">Last login</dt><dd>{formatTeamDateTime(detailMember.last_login_at)}</dd></div>
              <div><dt className="text-surface-500">User ID</dt><dd className="font-mono text-xs break-all">{detailMember.id}</dd></div>
            </dl>
          </div>
        </div>
      ) : null}

      {roleMember ? (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md shadow-card animate-slide-in">
            <h3 className="text-lg font-semibold text-surface-800 mb-2">Change role</h3>
            <p className="text-sm text-surface-500 mb-4">
              Update role for <strong>{roleMember.name}</strong>.
            </p>
            <select className="form-select mb-4" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              {INVITE_ROLES.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button type="button" className="btn-primary flex-1 justify-center" disabled={roleLoading} onClick={handleChangeRole}>
                {roleLoading ? 'Saving…' : 'Save role'}
              </button>
              <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setRoleMember(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(removeMember)}
        title="Remove admin access?"
        message={`Are you sure you want to remove admin access for ${removeMember?.name || 'this member'}? Their platform account will remain as a regular user.`}
        confirmLabel="Remove access"
        danger
        loading={removeLoading}
        onCancel={() => setRemoveMember(null)}
        onConfirm={handleRemove}
      />
    </div>
  )
}
