import { useState, useEffect, useCallback } from 'react'
import { requestsApi } from '../lib/api'
import { resolveApiError } from '../lib/backend'
import { LoadingSpinner, ErrorState, EmptyState } from '../components/States'
import MediatedChatActions from '../components/MediatedChatActions'
import {
  FileText, Search, Filter, RefreshCw, X, ChevronLeft, ChevronRight,
  User, Package, Calendar, MessageSquare, ExternalLink,
} from 'lucide-react'

// ── Status configuration ──────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'all',       label: 'All statuses' },
  { value: 'pending',   label: 'Pending / Open' },
  { value: 'approved',  label: 'Approved' },
  { value: 'rejected',  label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_BADGE = {
  pending:   'badge-yellow',
  approved:  'badge-blue',
  completed: 'badge-green',
  rejected:  'badge-red',
  cancelled: 'badge-gray',
}

function statusBadge(s) {
  return STATUS_BADGE[s] || 'badge-gray'
}

function fmtDate(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function fmtDatetime(val) {
  if (!val) return '—'
  return new Date(val).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Request detail modal ──────────────────────────────────────────────────────
function RequestDetailModal({ request, onClose }) {
  if (!request) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Request details"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 ring-1 ring-brand-200 flex items-center justify-center">
              <FileText className="w-4 h-4 text-brand-600" />
            </div>
            <div>
              <p className="font-semibold text-surface-800 leading-tight">Request Details</p>
              <p className="text-xs text-surface-500 font-mono">{request.id}</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon btn-ghost"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Status */}
          <div className="flex items-center gap-3">
            <span className={`badge ${statusBadge(request.status)} text-sm px-3 py-1`}>
              {request.status || 'unknown'}
            </span>
            <span className="text-xs text-surface-400">
              Created {fmtDatetime(request.created_at)}
            </span>
          </div>

          {/* Item */}
          <section className="card-sm space-y-2">
            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Listing
            </h4>
            <div className="flex items-start gap-3">
              {request.item_image_url ? (
                <img
                  src={request.item_image_url}
                  alt={request.item_title}
                  className="w-14 h-14 rounded-lg object-cover border border-surface-200 flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-surface-100 border border-surface-200 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-surface-400" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-surface-800 truncate">{request.item_title || '—'}</p>
                <p className="text-xs text-surface-500 font-mono mt-0.5">{request.item_id}</p>
                {request.item_status && (
                  <span className={`mt-1 badge ${statusBadge(request.item_status)} text-xs`}>
                    Item: {request.item_status}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* People */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <section className="card-sm space-y-2">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Requester
              </h4>
              <p className="font-medium text-surface-800">{request.requester_name || '—'}</p>
              <p className="text-xs text-surface-500 break-all">{request.requester_email || '—'}</p>
              <p className="text-xs text-surface-400 font-mono">{request.requester_id}</p>
            </section>
            <section className="card-sm space-y-2">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Lister / Owner
              </h4>
              <p className="font-medium text-surface-800">{request.owner_name || '—'}</p>
              <p className="text-xs text-surface-500 break-all">{request.owner_email || '—'}</p>
              <p className="text-xs text-surface-400 font-mono">{request.owner_id}</p>
            </section>
          </div>

          {/* Reason */}
          <section className="card-sm space-y-2">
            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Request Reason
            </h4>
            <p className="text-sm text-surface-700 leading-relaxed whitespace-pre-wrap">
              {request.reason || <span className="text-surface-400 italic">No reason provided.</span>}
            </p>
          </section>

          {/* Admin-mediated chats */}
          <MediatedChatActions requestId={request.id} requestStatus={request.status} />

          {/* Timeline */}
          <section className="card-sm space-y-2">
            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Timeline
            </h4>
            <dl className="space-y-1.5 text-sm">
              {[
                ['Created',   request.created_at],
                ['Updated',   request.updated_at],
                ['Approved',  request.approved_at],
                ['Rejected',  request.rejected_at],
                ['Completed', request.completed_at],
              ].filter(([, val]) => val).map(([label, val]) => (
                <div key={label} className="flex justify-between items-center">
                  <dt className="text-surface-500">{label}</dt>
                  <dd className="text-surface-700 font-medium">{fmtDatetime(val)}</dd>
                </div>
              ))}
              {!request.updated_at && !request.approved_at && !request.rejected_at && !request.completed_at && (
                <p className="text-surface-400 text-xs italic">No status changes recorded.</p>
              )}
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const LIMIT = 20

export default function RequestsPage() {
  const [requests, setRequests] = useState([])
  const [total, setTotal]       = useState(null) // null = not yet loaded (vs 0 = loaded empty)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState('all')
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState(null) // request for detail modal
  const { signalDataSuccess }   = useApiHealth()

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { limit: LIMIT, skip: (page - 1) * LIMIT }
      if (search.trim()) params.search = search.trim()
      if (status !== 'all') params.status = status

      const res = await requestsApi.list(params)
      const data = res.data
      const list = data.requests ?? data.items ?? (Array.isArray(data) ? data : [])
      setRequests(list)
      setTotal(typeof data.total === 'number' ? data.total : list.length)
      signalDataSuccess()
    } catch (err) {
      console.error('[AdminRequests] fetch failed:', err?.response?.status, err?.response?.config?.url, err?.message)
      setError(resolveApiError(err))
      // Don't reset total to 0 on error — keep whatever was last shown
    } finally {
      setLoading(false)
    }
  }, [search, status, page, signalDataSuccess])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  // Reset to page 1 when search/status changes
  const handleSearch = (val) => { setSearch(val); setPage(1) }
  const handleStatus = (val) => { setStatus(val); setPage(1) }

  const totalPages = total !== null ? Math.ceil(total / LIMIT) : 0

  return (
    <div className="animate-slide-in">
      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h2 className="page-title">Requests Management</h2>
          <p className="page-subtitle">
            {total === null
              ? 'Loading…'
              : error
              ? 'Failed to load'
              : `${total.toLocaleString()} exchange request${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchRequests}
          className="btn-secondary"
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Search & Filter Bar ───────────────────────────────────────────── */}
      <div className="card mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500 pointer-events-none" />
            <input
              id="requests-search"
              type="search"
              placeholder="Search item, requester, owner, reason…"
              className="form-input pl-8"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-surface-500" />
            <select
              id="requests-status-filter"
              className="form-select w-44"
              value={status}
              onChange={(e) => handleStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Table / State ─────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Loading requests…" />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchRequests} />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No requests found"
            description={
              search || status !== 'all'
                ? 'Try adjusting the search or status filter.'
                : 'No exchange requests have been created yet.'
            }
          />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Listing</th>
                    <th>Requester</th>
                    <th>Owner / Lister</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>View</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(req)}
                    >
                      {/* Listing */}
                      <td>
                        <div className="flex items-center gap-2.5 min-w-0">
                          {req.item_image_url ? (
                            <img
                              src={req.item_image_url}
                              alt={req.item_title}
                              className="w-8 h-8 rounded-lg object-cover border border-surface-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-surface-100 border border-surface-200 flex items-center justify-center flex-shrink-0">
                              <Package className="w-3.5 h-3.5 text-surface-400" />
                            </div>
                          )}
                          <span className="text-surface-800 font-medium truncate max-w-[160px]">
                            {req.item_title || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Requester */}
                      <td>
                        <p className="text-surface-700 text-sm font-medium">{req.requester_name || '—'}</p>
                        <p className="text-surface-500 text-xs truncate max-w-[140px]">{req.requester_email || ''}</p>
                      </td>

                      {/* Owner */}
                      <td>
                        <p className="text-surface-700 text-sm font-medium">{req.owner_name || '—'}</p>
                        <p className="text-surface-500 text-xs truncate max-w-[140px]">{req.owner_email || ''}</p>
                      </td>

                      {/* Reason preview */}
                      <td className="text-surface-500 text-sm max-w-[180px]">
                        <span className="line-clamp-2 block">
                          {req.reason ? (req.reason.length > 80 ? req.reason.slice(0, 80) + '…' : req.reason) : '—'}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`badge ${statusBadge(req.status)}`}>
                          {req.status || '—'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="text-surface-500 text-xs whitespace-nowrap">
                        {fmtDate(req.created_at)}
                      </td>

                      {/* View action */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn-icon btn-ghost"
                          title="View request details"
                          onClick={() => setSelected(req)}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-surface-300">
                <p className="text-xs text-surface-500">
                  Page {page} of {totalPages} · {total?.toLocaleString()} total
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Detail modal ──────────────────────────────────────────────────── */}
      {selected && (
        <RequestDetailModal request={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
