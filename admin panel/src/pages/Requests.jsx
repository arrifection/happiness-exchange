import { useState, useEffect, useCallback } from 'react'
import { requestsApi } from '../lib/api'
import { LoadingSpinner, ErrorState, EmptyState } from '../components/States'
import { FileText, Search, Filter, RefreshCw } from 'lucide-react'

const STATUS_OPTIONS = ['all', 'pending', 'accepted', 'rejected', 'completed', 'cancelled']

export default function RequestsPage() {
  const [requests, setRequests] = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState('all')
  const [page, setPage]         = useState(1)
  const limit = 20

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { limit, skip: (page - 1) * limit }
      if (search) params.search = search
      if (status !== 'all') params.status = status
      const res = await requestsApi.list(params)
      const data = res.data
      setRequests(Array.isArray(data) ? data : (data.requests || data.items || []))
      setTotal(data.total || (Array.isArray(data) ? data.length : 0))
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }, [search, status, page])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const totalPages = Math.ceil(total / limit)

  const statusBadge = (s) => ({
    pending:   'badge-yellow',
    accepted:  'badge-blue',
    completed: 'badge-green',
    rejected:  'badge-red',
    cancelled: 'badge-gray',
  }[s] || 'badge-gray')

  return (
    <div className="animate-slide-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h2 className="page-title">Requests Management</h2>
          <p className="page-subtitle">{total.toLocaleString()} exchange requests</p>
        </div>
        <button onClick={fetchRequests} className="btn-secondary">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="card mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
            <input type="search" placeholder="Search requests…" className="form-input pl-8" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-surface-500" />
            <select className="form-select w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? <LoadingSpinner message="Loading requests…" />
        : error   ? <ErrorState message={error} onRetry={fetchRequests} />
        : requests.length === 0 ? <EmptyState icon={FileText} title="No requests found" />
        : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Item</th>
                    <th>Requester</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req._id || req.id}>
                      <td className="font-mono text-xs text-surface-500">{(req._id || req.id || '').slice(-8)}</td>
                      <td className="text-surface-800 font-medium">{req.item_title || req.item_id || '—'}</td>
                      <td className="text-surface-600 text-xs font-mono">{req.requester_id || req.user_id || '—'}</td>
                      <td className="text-surface-600 text-xs font-mono">{req.owner_id || '—'}</td>
                      <td><span className={`badge ${statusBadge(req.status)}`}>{req.status || '—'}</span></td>
                      <td className="text-surface-500 text-xs">{req.created_at ? new Date(req.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-surface-300">
                <p className="text-xs text-surface-500">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary py-1.5 px-3 text-xs">Previous</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary py-1.5 px-3 text-xs">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
