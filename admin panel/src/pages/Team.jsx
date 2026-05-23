import { useState } from 'react'
import { UsersRound, Plus, Mail, Shield, Trash2 } from 'lucide-react'
import { ROLES } from '../contexts/AuthContext'
import { useAuth } from '../contexts/AuthContext'

const MOCK_TEAM = [
  { id: '1', name: 'Sara Al-Rashid', email: 'sara@happinessexchange.com', role: 'super_admin', joined: '2025-01-10', status: 'active' },
  { id: '2', name: 'Ahmed Hassan',   email: 'ahmed@happinessexchange.com', role: 'admin',       joined: '2025-03-05', status: 'active' },
  { id: '3', name: 'Layla Karimi',   email: 'layla@happinessexchange.com', role: 'moderator',   joined: '2025-04-18', status: 'active' },
  { id: '4', name: 'Omar Nasser',    email: 'omar@happinessexchange.com',  role: 'courier',     joined: '2025-05-01', status: 'active' },
]

const roleColors = {
  super_admin: 'badge-purple',
  admin:       'badge-blue',
  moderator:   'badge-yellow',
  courier:     'badge-green',
}

const roleGradients = {
  super_admin: 'from-purple-600 to-pink-600',
  admin:       'from-brand-600 to-blue-600',
  moderator:   'from-amber-600 to-orange-600',
  courier:     'from-emerald-600 to-teal-600',
}

export default function TeamPage() {
  const { isSuperAdmin } = useAuth()
  const [members, setMembers] = useState(MOCK_TEAM)
  const [showInvite, setShowInvite] = useState(false)
  const [invite, setInvite] = useState({ email: '', role: ROLES.MODERATOR })

  const remove = (id) => {
    if (!confirm('Remove this team member?')) return
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }

  const handleInvite = (e) => {
    e.preventDefault()
    alert(`Invite sent to ${invite.email} with role: ${invite.role}`)
    setShowInvite(false)
    setInvite({ email: '', role: ROLES.MODERATOR })
  }

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

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md shadow-2xl animate-slide-in">
            <h3 className="text-lg font-semibold text-surface-100 mb-5">Invite Team Member</h3>
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

      {/* Team grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {members.map((m) => (
          <div key={m.id} className="card hover:border-surface-700 transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${roleGradients[m.role] || 'from-brand-600 to-purple-600'} flex items-center justify-center text-white text-lg font-bold shadow-lg`}>
                  {m.name[0]}
                </div>
                <div>
                  <p className="font-semibold text-surface-100">{m.name}</p>
                  <span className={`badge mt-1 ${roleColors[m.role] || 'badge-gray'}`}>
                    <Shield className="w-2.5 h-2.5" />
                    {m.role.replace('_', ' ')}
                  </span>
                </div>
              </div>
              {isSuperAdmin() && (
                <button onClick={() => remove(m.id)} className="btn-icon btn-ghost text-surface-600 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-surface-400">
                <Mail className="w-3.5 h-3.5 text-surface-600 flex-shrink-0" />
                <span className="truncate">{m.email}</span>
              </div>
              <div className="flex items-center gap-2 text-surface-500 text-xs">
                <UsersRound className="w-3 h-3 text-surface-600 flex-shrink-0" />
                Joined {new Date(m.joined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
