import { useState, useEffect, useCallback } from 'react'
import { itemsApi } from '../lib/api'
import { LoadingSpinner, ErrorState, EmptyState } from '../components/States'
import { Package, Search, Filter, Trash2, CheckCircle, RefreshCw, Eye } from 'lucide-react'

const STATUS_OPTIONS = ['all', 'active', 'pending', 'expired', 'donated']

export default function ListingsPage() {
  const [items, setItems]     = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('all')
  const [page, setPage]       = useState(1)
  const limit = 20

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { limit, skip: (page - 1) * limit }
      if (search) params.search = search
      if (status !== 'all') params.status = status
      const res = await itemsApi.list(params)
      const data = res.data
      setItems(Array.isArray(data) ? data : (data.items || []))
      setTotal(data.total || (Array.isArray(data) ? data.length : 0))
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }, [search, status, page])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleDelete = async (id) => {
    if (!confirm('Delete this listing? This cannot be undone.')) return
    try {
      await itemsApi.delete(id)
      fetchItems()
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed.')
    }
  }

  const handleApprove = async (id) => {
    try {
      await itemsApi.approve(id)
      fetchItems()
    } catch (err) {
      alert(err.response?.data?.detail || 'Approval failed.')
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="animate-slide-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h2 className="page-title">Listings Management</h2>
          <p className="page-subtitle">{total.toLocaleString()} total listings on the platform</p>
        </div>
        <button onClick={fetchItems} className="btn-secondary">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
            <input
              type="search"
              placeholder="Search listings…"
              className="form-input pl-8"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-surface-500" />
            <select
              className="form-select w-36"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Loading listings…" />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchItems} />
        ) : items.length === 0 ? (
          <EmptyState icon={Package} title="No listings found" description="Try adjusting your search or filters." />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id || item.id}>
                      <td className="font-medium text-surface-200 max-w-[200px] truncate">
                        {item.title || item.name || '—'}
                      </td>
                      <td>
                        <span className="badge badge-blue">{item.category || '—'}</span>
                      </td>
                      <td className="text-surface-400 text-xs font-mono">
                        {item.owner_id || item.user_id || '—'}
                      </td>
                      <td>
                        <span className={`badge ${
                          item.status === 'active'  ? 'badge-green'  :
                          item.status === 'pending' ? 'badge-yellow' :
                          item.status === 'donated' ? 'badge-blue'   :
                          'badge-gray'
                        }`}>
                          {item.status || '—'}
                        </span>
                      </td>
                      <td className="text-surface-500 text-xs">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          {item.status === 'pending' && (
                            <button
                              onClick={() => handleApprove(item._id || item.id)}
                              className="btn-icon btn-success"
                              title="Approve"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(item._id || item.id)}
                            className="btn-icon btn-danger"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-surface-800">
                <p className="text-xs text-surface-500">
                  Page {page} of {totalPages} · {total} results
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
