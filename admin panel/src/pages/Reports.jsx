import { useEffect, useState } from 'react'
import { Flag, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'
import { EmptyState, LoadingSpinner, ErrorState } from '../components/States'
import { reportsApi } from '../lib/api'
import { resolveApiError } from '../lib/backend'

const statusBadge = {
  open: 'badge-red',
  reviewing: 'badge-yellow',
  resolved: 'badge-green',
  dismissed: 'badge-gray',
}
const statusIcon = {
  open: <AlertTriangle className="w-3.5 h-3.5" />,
  reviewing: <Clock className="w-3.5 h-3.5" />,
  resolved: <CheckCircle className="w-3.5 h-3.5" />,
  dismissed: <XCircle className="w-3.5 h-3.5" />,
}

export default function ReportsPage() {
  const [reports, setReports] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState('')

  const loadReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = filter === 'all' ? { limit: 100 } : { status: filter, limit: 100 }
      const res = await reportsApi.list(params)
      setReports(res.data.reports || [])
    } catch (err) {
      setError(resolveApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReports() }, [filter])

  const resolve = async (id) => {
    setActionError('')
    try {
      await reportsApi.resolve(id)
      await loadReports()
    } catch (err) {
      setActionError(resolveApiError(err))
    }
  }

  const dismiss = async (id) => {
    setActionError('')
    try {
      await reportsApi.dismiss(id)
      await loadReports()
    } catch (err) {
      setActionError(resolveApiError(err))
    }
  }

  const openCount = reports.filter((r) => r.status === 'open').length
  const reviewingCount = reports.filter((r) => r.status === 'reviewing').length

  if (loading) return <LoadingSpinner message="Loading reports…" />
  if (error) return <ErrorState message={error} onRetry={loadReports} />

  return (
    <div className="animate-slide-in">
      <div className="page-header">
        <h2 className="page-title">Reports & Flags</h2>
        <p className="page-subtitle">Content moderation and user reports</p>
      </div>

      {actionError && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{actionError}</p>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Open Reports', value: openCount, color: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-200' },
          { label: 'Under Review', value: reviewingCount, color: 'text-accent-600', bg: 'bg-accent-50', ring: 'ring-accent-200' },
          { label: 'Resolved', value: reports.filter((r) => r.status === 'resolved').length, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
        ].map(({ label, value, color, bg, ring }) => (
          <div key={label} className="card-sm flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} ring-1 ${ring} flex items-center justify-center`}>
              <Flag className={`w-4 h-4 ${color}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-surface-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 mb-5 p-1 bg-white border border-surface-300 rounded-xl w-fit shadow-soft">
        {['all', 'open', 'reviewing', 'resolved', 'dismissed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              filter === f ? 'bg-brand-600 text-white shadow-sm' : 'text-surface-600 hover:text-surface-800'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        {reports.length === 0 ? (
          <EmptyState icon={Flag} title="No reports" description="All clear! No reports match this filter." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-surface-800">{r.type}</td>
                    <td className="text-surface-600 text-xs font-mono">{r.target_type} / {r.target_id?.slice?.(-8) || r.target_id}</td>
                    <td className="text-surface-600 text-sm max-w-xs truncate">{r.description || '—'}</td>
                    <td>
                      <span className={`badge ${statusBadge[r.status] || 'badge-gray'} gap-1`}>
                        {statusIcon[r.status]}
                        {r.status}
                      </span>
                    </td>
                    <td className="text-surface-500 text-xs">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {r.status !== 'resolved' && r.status !== 'dismissed' && (
                          <button onClick={() => resolve(r.id)} className="btn-success text-xs py-1 px-2">
                            <CheckCircle className="w-3 h-3" />
                            Resolve
                          </button>
                        )}
                        {r.status !== 'dismissed' && r.status !== 'resolved' && (
                          <button onClick={() => dismiss(r.id)} className="btn-ghost text-xs py-1 px-2">
                            <XCircle className="w-3 h-3" />
                            Dismiss
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
