import { useEffect, useState } from 'react'
import { UsersRound, Plus, Mail, Shield, Trash2 } from 'lucide-react'
import { ROLES } from '../contexts/AuthContext'
import { useAuth } from '../contexts/AuthContext'
import { teamApi } from '../lib/api'
import { LoadingSpinner, ErrorState } from '../components/States'
import { resolveApiError } from '../lib/backend'

const roleColors = {
  super_admin: 'badge-purple',
  admin:       'badge-blue',
  moderator:   'badge-yellow',
  courier:     'badge-green',
}

const roleGradients = {
  super_admin: 'from-purple-600 to-pink-600',
  admin:       'from-brand-600 to-brand-700',
  moderator:   'from-amber-600 to-orange-600',
  courier:     'from-emerald-600 to-teal-600',
}

export default function TeamPage() {
  const { isSuperAdmin } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showInvite, setShowInvite] = useState(false)
  const [invite, setInvite] = useState({ email: '', role: ROLES.MODERATOR })
  const [actionError, setActionError] = useState('')

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

  const remove = async (id) => {
    if (!confirm('Remove this team member?')) return
    setActionError('')
    try {
      await teamApi.remove(id)
      await loadTeam()
    } catch (err) {
      setActionError(resolveApiError(err))
    }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setActionError('')
    try {
      await teamApi.invite(invite)
      setShowInvite(false)
      setInvite({ email: '', role: ROLES.MODERATOR })
      await loadTeam()
    } catch (err) {
      setActionError(resolveApiError(err))
    }
  }

  if (loading) return <LoadingSpinner message="Loading team…" />
  if (error) return <ErrorState message={error} onRetry={loadTeam} />

  return (
    <div className="animate-slide-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h2 className="page-title">Team Members</h2>
          <p className="page-subtitle">{members.length} admin team members</p>
        </div>
        {isSuperAdmin() && (
          <button onClick={() => setShowInvite(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Invite Member
          </button>
        )}
      </div>

      {actionError && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{actionError}</p>
      )}

      {showInvite && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md shadow-card animate-slide-in">
            <h3 className="text-lg font-semibold text-surface-800 mb-5">Invite Team Member</h3>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="form-label">Email Address</label>
                <input type="email" required className="form-input" placeholder="colleague@company.com" value={invite.email} onChange={(e) => setInvite((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Role</label>
                <select className="form-select" value={invite.role} onChange={(e) => setInvite((f) => ({ ...f, role: e.target.value }))}>
                  <option value={ROLES.MODERATOR}>Moderator</option>
                  <option value={ROLES.ADMIN}>Admin</option>
                  <option value={ROLES.COURIER}>Courier</option>
                  {isSuperAdmin() && <option value={ROLES.SUPER_ADMIN}>Super Admin</option>}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 justify-center">Send Invite</button>
                <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {members.map((m) => {
          const name = m.name || m.full_name || m.email
          const joined = m.created_at ? new Date(m.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'
          return (
            <div key={m.id} className="card hover:border-brand-200 transition-all duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${roleGradients[m.role] || 'from-brand-600 to-brand-700'} flex items-center justify-center text-white text-lg font-bold shadow-soft`}>
                    {name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-surface-800">{name}</p>
                    <span className={`badge mt-1 ${roleColors[m.role] || 'badge-gray'}`}>
                      <Shield className="w-2.5 h-2.5" />
                      {m.role?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                {isSuperAdmin() && (
                  <button onClick={() => remove(m.id)} className="btn-icon btn-ghost text-surface-600 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-surface-600">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{m.email}</span>
                </div>
                <div className="flex items-center gap-2 text-surface-500 text-xs">
                  <UsersRound className="w-3 h-3 flex-shrink-0" />
                  Joined {joined}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
