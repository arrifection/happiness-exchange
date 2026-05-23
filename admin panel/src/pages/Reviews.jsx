import { useState, useEffect, useCallback } from 'react'
import { reviewsApi } from '../lib/api'
import { LoadingSpinner, ErrorState, EmptyState } from '../components/States'
import { Star, Trash2, RefreshCw } from 'lucide-react'

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-surface-700'}`}
        />
      ))}
    </div>
  )
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [page, setPage]       = useState(1)
  const limit = 20

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await reviewsApi.list({ limit, skip: (page - 1) * limit })
      const data = res.data
      setReviews(Array.isArray(data) ? data : (data.reviews || data.items || []))
      setTotal(data.total || (Array.isArray(data) ? data.length : 0))
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const handleDelete = async (id) => {
    if (!confirm('Delete this review permanently?')) return
    try {
      await reviewsApi.delete(id)
      fetchReviews()
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed.')
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="animate-slide-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h2 className="page-title">Reviews Management</h2>
          <p className="page-subtitle">{total.toLocaleString()} platform reviews</p>
        </div>
        <button onClick={fetchReviews} className="btn-secondary">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? <LoadingSpinner message="Loading reviews…" />
        : error   ? <ErrorState message={error} onRetry={fetchReviews} />
        : reviews.length === 0 ? <EmptyState icon={Star} title="No reviews found" />
        : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Reviewer</th>
                    <th>Reviewee</th>
                    <th>Rating</th>
                    <th>Comment</th>
                    <th>Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r._id || r.id}>
                      <td className="font-mono text-xs text-surface-400">{r.reviewer_id || r.reviewer || '—'}</td>
                      <td className="font-mono text-xs text-surface-400">{r.reviewee_id || r.reviewee || '—'}</td>
                      <td><StarRating rating={r.rating || r.score || 0} /></td>
                      <td className="max-w-[240px]">
                        <p className="text-sm text-surface-300 truncate">{r.comment || r.text || '—'}</p>
                      </td>
                      <td className="text-surface-500 text-xs">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div className="flex items-center justify-end">
                          <button onClick={() => handleDelete(r._id || r.id)} className="btn-icon btn-danger" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-surface-800">
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
