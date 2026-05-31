import { useState, useEffect, useCallback } from 'react'
import { itemsApi } from '../lib/api'
import { resolveApiError } from '../lib/backend'
import { LoadingSpinner, ErrorState, EmptyState } from '../components/States'
import ConfirmDialog from '../components/ConfirmDialog'
import ListingDetailModal from '../components/ListingDetailModal'
import ListingThumbnail from '../components/ListingThumbnail'
import {
  formatListingDate,
  getListingId,
  getListingOwnerLabel,
  getListingStatusBadgeClass,
} from '../lib/listings'
import { Package, Search, Filter, Trash2, CheckCircle, RefreshCw, Eye } from 'lucide-react'

const STATUS_OPTIONS = ['all', 'active', 'available', 'pending', 'reserved', 'completed', 'expired', 'donated']

export default function ListingsPage() {
  const [items, setItems]     = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('all')
  const [page, setPage]       = useState(1)
  const [toast, setToast]     = useState('')
  const [viewItem, setViewItem] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const limit = 20

  const showToast = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 4000)
  }

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
      setError(resolveApiError(err))
    } finally {
      setLoading(false)
    }
  }, [search, status, page])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleDelete = async () => {
    const itemId = getListingId(deleteTarget)
    if (!itemId) return

    setDeleteLoading(true)
    try {
      await itemsApi.delete(itemId)
      showToast('Listing deleted successfully.')
      setDeleteTarget(null)
      fetchItems()
    } catch (err) {
      showToast(resolveApiError(err, 'Delete failed.'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleApprove = async (id) => {
    try {
      await itemsApi.approve(id)
      showToast('Listing approved.')
      fetchItems()
    } catch (err) {
      showToast(resolveApiError(err, 'Approval failed.'))
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="animate-slide-in">
      {toast ? (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${toast.includes('failed') || toast.includes('Unable') ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {toast}
        </div>
      ) : null}

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
                    <th>Listing</th>
                    <th>Category</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const itemId = getListingId(item)
                    return (
                      <tr key={itemId}>
                        <td>
                          <div className="flex items-center gap-3 min-w-[220px]">
                            <ListingThumbnail item={item} />
                            <div className="min-w-0">
                              <p className="font-medium text-surface-800 truncate">{item.title || item.name || '—'}</p>
                              <p className="text-xs text-surface-500 truncate">{item.location_display || item.city || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-blue">{item.category || '—'}</span>
                        </td>
                        <td className="text-surface-600 text-xs">
                          {getListingOwnerLabel(item)}
                        </td>
                        <td>
                          <span className={`badge ${getListingStatusBadgeClass(item.status)}`}>
                            {item.status || '—'}
                          </span>
                        </td>
                        <td className="text-surface-500 text-xs">
                          {formatListingDate(item.created_at)}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setViewItem(item)}
                              className="btn-icon btn-ghost"
                              title="View"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {item.status === 'pending' && (
                              <button
                                onClick={() => handleApprove(itemId)}
                                className="btn-icon btn-success"
                                title="Approve"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className="btn-icon btn-danger"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      <ListingDetailModal
        open={Boolean(viewItem)}
        itemId={getListingId(viewItem)}
        fallbackItem={viewItem}
        onClose={() => setViewItem(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete listing?"
        message={`This will permanently remove "${deleteTarget?.title || 'this listing'}" and its related requests.`}
        confirmLabel="Delete listing"
        danger
        loading={deleteLoading}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
