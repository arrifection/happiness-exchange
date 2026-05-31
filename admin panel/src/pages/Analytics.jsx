import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Package, FileText, Star, Activity, RefreshCw, Clock } from 'lucide-react'
import { analyticsApi } from '../lib/api'
import { LoadingSpinner, ErrorState } from '../components/States'
import StatCard from '../components/StatCard'
import { resolveApiError } from '../lib/backend'
import { useApiHealth } from '../contexts/ApiHealthContext'

export default function AnalyticsPage() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const { signalDataSuccess } = useApiHealth()
  const navigate = useNavigate()

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await analyticsApi.summary()
      setSummary(res.data)
      setLastUpdated(new Date())
      // Signal shared health context — data loaded = backend is reachable.
      signalDataSuccess()
    } catch (err) {
      setError(resolveApiError(err))
    } finally {
      setLoading(false)
    }
  }, [signalDataSuccess])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  if (loading) return <LoadingSpinner message="Loading analytics…" />
  if (error)   return <ErrorState message={error} onRetry={fetchSummary} />

  const openRequests      = summary.requests?.open      ?? 0
  const totalRequests     = summary.requests?.total     ?? 0
  // Completion rate = exchanges that were fully completed / all requests ever created.
  // Uses dedicated `completed` count from backend so rejected requests don't inflate the %.
  const completedRequests = summary.requests?.completed ?? 0
  const completionRate    = totalRequests > 0
    ? Math.round((completedRequests / totalRequests) * 100)
    : 0

  const formattedTime = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="animate-slide-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h2 className="page-title">Analytics</h2>
          <p className="page-subtitle">Live counts from the production database. Click a card to inspect records.</p>
        </div>
        <div className="flex items-center gap-3">
          {formattedTime && (
            <span className="flex items-center gap-1.5 text-xs text-surface-400">
              <Clock className="w-3 h-3" />
              Updated {formattedTime}
            </span>
          )}
          <button
            type="button"
            className="btn-secondary text-xs py-1.5 px-3"
            onClick={fetchSummary}
            title="Refresh analytics"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Top-level stat cards (clickable) ───────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {/* Total Listings → /listings */}
        <StatCard
          label="Total Listings"
          value={(summary.items?.total ?? 0).toLocaleString()}
          icon={Package}
          color="brand"
          sub={`${(summary.items?.active ?? 0).toLocaleString()} active`}
          to="/listings"
        />
        {/* Total Users → /users */}
        <StatCard
          label="Total Users"
          value={(summary.users?.total ?? 0).toLocaleString()}
          icon={Users}
          color="emerald"
          sub={`${summary.users?.banned ?? 0} banned`}
          to="/users"
        />
        {/* Exchange Requests → /requests */}
        <StatCard
          label="Exchange Requests"
          value={totalRequests.toLocaleString()}
          icon={FileText}
          color="amber"
          sub={`${openRequests} open`}
          to="/requests"
        />
        {/* Completion Rate → /requests (completed filter) */}
        <StatCard
          label="Completion Rate"
          value={`${completionRate}%`}
          icon={Activity}
          color="purple"
          sub={`${completedRequests} completed of ${totalRequests}`}
          to="/requests"
        />
      </div>

      {/* ── Detail cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Listings breakdown */}
        <div className="card">
          <h3 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-brand-600" />
            Listings
          </h3>
          <dl className="space-y-3 text-sm">
            <div
              className="flex justify-between items-center py-1.5 rounded-lg px-2 -mx-2 hover:bg-surface-50 cursor-pointer transition-colors"
              role="link"
              tabIndex={0}
              onClick={() => navigate('/listings')}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/listings')}
              title="View all listings"
            >
              <dt className="text-surface-500">Total</dt>
              <dd className="font-semibold text-surface-800">{summary.items?.total ?? 0}</dd>
            </div>
            <div
              className="flex justify-between items-center py-1.5 rounded-lg px-2 -mx-2 hover:bg-surface-50 cursor-pointer transition-colors"
              role="link"
              tabIndex={0}
              onClick={() => navigate('/listings')}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/listings')}
              title="View active listings (available + reserved)"
            >
              <dt className="text-surface-500">
                Active
                <span className="ml-1.5 text-xs text-surface-400 font-normal">(available + reserved)</span>
              </dt>
              <dd className="font-semibold text-emerald-700">{summary.items?.active ?? 0}</dd>
            </div>
            <div
              className="flex justify-between items-center py-1.5 rounded-lg px-2 -mx-2 hover:bg-surface-50 cursor-pointer transition-colors"
              role="link"
              tabIndex={0}
              onClick={() => navigate('/listings')}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/listings')}
              title="View completed listings"
            >
              <dt className="text-surface-500">Completed</dt>
              <dd className="font-semibold text-surface-800">{summary.items?.completed ?? 0}</dd>
            </div>
          </dl>
        </div>

        {/* Reviews & Requests breakdown */}
        <div className="card">
          <h3 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-purple-600" />
            Reviews &amp; Requests
          </h3>
          <dl className="space-y-3 text-sm">
            <div
              className="flex justify-between items-center py-1.5 rounded-lg px-2 -mx-2 hover:bg-surface-50 cursor-pointer transition-colors"
              role="link"
              tabIndex={0}
              onClick={() => navigate('/reviews')}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/reviews')}
              title="View all reviews"
            >
              <dt className="text-surface-500">Total reviews</dt>
              <dd className="font-semibold text-surface-800">{summary.reviews?.total ?? 0}</dd>
            </div>
            <div
              className="flex justify-between items-center py-1.5 rounded-lg px-2 -mx-2 hover:bg-surface-50 cursor-pointer transition-colors"
              role="link"
              tabIndex={0}
              onClick={() => navigate('/requests')}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/requests')}
              title="View open (pending) requests"
            >
              <dt className="text-surface-500">Open requests</dt>
              <dd className="font-semibold text-amber-600">{openRequests}</dd>
            </div>
            <div
              className="flex justify-between items-center py-1.5 rounded-lg px-2 -mx-2 hover:bg-surface-50 cursor-pointer transition-colors"
              role="link"
              tabIndex={0}
              onClick={() => navigate('/requests')}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/requests')}
              title="View all requests"
            >
              <dt className="text-surface-500">Total requests</dt>
              <dd className="font-semibold text-surface-800">{totalRequests}</dd>
            </div>
            <div
              className="flex justify-between items-center py-1.5 rounded-lg px-2 -mx-2 hover:bg-surface-50 cursor-pointer transition-colors"
              role="link"
              tabIndex={0}
              onClick={() => navigate('/requests')}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/requests')}
              title="View completed requests"
            >
              <dt className="text-surface-500">
                Completion rate
                <span className="ml-1.5 text-xs text-surface-400 font-normal">completed / total</span>
              </dt>
              <dd className="font-semibold text-purple-700">{completionRate}%</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
