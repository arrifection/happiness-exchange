import { useState, useEffect, useCallback } from 'react'
import { usersApi } from '../lib/api'
import { resolveApiError } from '../lib/backend'
import { LoadingSpinner, ErrorState, EmptyState } from '../components/States'
import { Users, Search, Ban, RefreshCw, MoreVertical } from 'lucide-react'

export default function UsersPage() {
  const [users, setUsers]     = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const limit = 20

  const [penaltyModal, setPenaltyModal] = useState({ open: false, user: null, amount: 20, reason: '' })

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { limit, skip: (page - 1) * limit }
      if (search) params.search = search
      const res = await usersApi.list(params)
      const data = res.data
      setUsers(Array.isArray(data) ? data : (data.users || data.items || []))
      setTotal(data.total || (Array.isArray(data) ? data.length : 0))
    } catch (err) {
      setError(resolveApiError(err))
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleBan = async (id, name) => {
    if (!confirm(`Ban user "${name}"? They will lose platform access.`)) return
    try {
      await usersApi.ban(id)
      fetchUsers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Ban failed.')
    }
  }

  const handlePenaltySubmit = async (e) => {
    e.preventDefault()
    if (!penaltyModal.user) return
    try {
      await usersApi.trustPenalty(penaltyModal.user._id || penaltyModal.user.id, {
        amount: Number(penaltyModal.amount),
        reason: penaltyModal.reason
      })
      setPenaltyModal({ open: false, user: null, amount: 20, reason: '' })
      fetchUsers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to deduct points.')
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="animate-slide-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h2 className="page-title">Users Management</h2>
          <p className="page-subtitle">{total.toLocaleString()} registered users</p>
        </div>
        <button onClick={fetchUsers} className="btn-secondary">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="card mb-5">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
          <input
            type="search"
            placeholder="Search by name or email…"
            className="form-input pl-8"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Loading users…" />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchUsers} />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="No users found" />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const uid   = u._id || u.id
                    const name  = u.full_name || u.username || u.name || 'Unknown'
                    const email = u.email || '—'
                    const role  = u.role  || 'user'
                    const status = u.is_active === false ? 'banned' : (u.status || 'active')
                    return (
                      <tr key={uid}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {name[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-surface-800">{name}</span>
                          </div>
                        </td>
                        <td className="text-surface-600">{email}</td>
                        <td>
                          <span className={`badge ${
                            role === 'super_admin' ? 'badge-purple' :
                            role === 'admin'       ? 'badge-blue'   :
                            role === 'moderator'   ? 'badge-yellow' :
                            'badge-gray'
                          }`}>
                            {role.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${status === 'active' ? 'badge-green' : 'badge-red'}`}>
                            {status}
                          </span>
                        </td>
                        <td className="text-surface-500 text-xs">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setPenaltyModal({ open: true, user: u, amount: 20, reason: '' })}
                              className="btn-icon"
                              title="Deduct Trust Points"
                            >
                              <span className="text-[10px] font-bold uppercase tracking-widest bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded">Pts</span>
                            </button>
                            <button
                              onClick={() => handleBan(uid, name)}
                              className="btn-icon btn-danger"
                              title="Ban user"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-surface-300">
                <p className="text-xs text-surface-500">Page {page} of {totalPages} · {total} users</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary py-1.5 px-3 text-xs">Previous</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary py-1.5 px-3 text-xs">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Penalty Modal */}
      {penaltyModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-slide-in">
            <div className="px-6 py-4 border-b border-surface-200">
              <h3 className="font-bold text-surface-900">Deduct Trust Points</h3>
              <p className="text-xs text-surface-500 mt-1">Penalize user: {penaltyModal.user?.full_name || penaltyModal.user?.username}</p>
            </div>
            <form onSubmit={handlePenaltySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-surface-700 mb-1">Amount to Deduct</label>
                <select 
                  value={penaltyModal.amount} 
                  onChange={(e) => setPenaltyModal(s => ({ ...s, amount: e.target.value }))}
                  className="form-input"
                  required
                >
                  <option value="15">15 (Abusive chat)</option>
                  <option value="20">20 (Confirmed report)</option>
                  <option value="30">30 (Scam behavior)</option>
                  <option value="50">50 (Severe violation)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-surface-700 mb-1">Reason</label>
                <input 
                  type="text" 
                  value={penaltyModal.reason} 
                  onChange={(e) => setPenaltyModal(s => ({ ...s, reason: e.target.value }))}
                  placeholder="e.g. Abusive chat logs in Request #123"
                  className="form-input"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setPenaltyModal({ open: false, user: null, amount: 20, reason: '' })}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary bg-red-600 hover:bg-red-700 text-white">
                  Deduct Points
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
