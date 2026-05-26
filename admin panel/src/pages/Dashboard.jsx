import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import StatCard from '../components/StatCard'
import { LoadingSpinner, ErrorState } from '../components/States'
import {
  Package, Users, FileText, Star, TrendingUp, CheckCircle, AlertTriangle,
} from 'lucide-react'
import { analyticsApi, itemsApi, reportsApi, statusApi } from '../lib/api'
import { resolveApiError } from '../lib/backend'

const RECENT_ITEMS_COUNT = 5

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats]     = useState(null)
  const [recent, setRecent]   = useState([])
  const [health, setHealth]   = useState({ api: 'checking', openReports: null })
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [summaryRes, itemsRes, reportsRes] = await Promise.all([
          analyticsApi.summary(),
          itemsApi.list({ limit: RECENT_ITEMS_COUNT }),
          reportsApi.list({ status: 'open', limit: 1 }),
        ])

        let apiStatus = 'online'
        try {
          await statusApi.check()
        } catch {
          apiStatus = 'offline'
        }

        const summary = summaryRes.data
        setHealth({ api: apiStatus, openReports: reportsRes.data.total ?? 0 })
        setStats({
          totalItems:    summary.items?.total ?? 0,
          totalUsers:    summary.users?.total ?? 0,
          totalRequests: summary.requests?.open ?? summary.requests?.total ?? 0,
          totalReviews:  summary.reviews?.total ?? 0,
        })
        setRecent(Array.isArray(itemsRes.data.items) ? itemsRes.data.items : [])
      } catch (err) {
        setError(resolveApiError(err))
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  })()

  const displayName =
    user?.full_name?.split(' ')[0] ||
    user?.name?.split(' ')[0] ||
    user?.username ||
    'Admin'

  if (loading) return <LoadingSpinner message="Loading dashboard…" />
  if (error)   return <ErrorState message={error} onRetry={() => window.location.reload()} />

  return (
    <div className="animate-slide-in">
      <div className="page-header">
        <h2 className="page-title">
          {greeting},{' '}
          <span className="text-gradient">{displayName}</span>
        </h2>
        <p className="page-subtitle">Live platform data from the production backend.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard label="Total Listings" value={stats?.totalItems?.toLocaleString() ?? '—'} icon={Package} color="brand" sub="All items on platform" />
        <StatCard label="Registered Users" value={stats?.totalUsers?.toLocaleString() ?? '—'} icon={Users} color="emerald" sub="Total accounts" />
        <StatCard label="Open Requests" value={stats?.totalRequests?.toLocaleString() ?? '—'} icon={FileText} color="amber" sub="Pending exchanges" />
        <StatCard label="Reviews" value={stats?.totalReviews?.toLocaleString() ?? '—'} icon={Star} color="purple" sub="Platform feedback" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-surface-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              Recent Listings
            </h3>
            <Link to="/listings" className="text-xs text-brand-600 hover:text-brand-700 transition-colors">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-surface-500 text-sm py-6 text-center">No listings yet.</p>
          ) : (
            <div className="space-y-3">
              {recent.map((item, i) => (
                <div key={item._id || item.id || i} className="flex items-center gap-4 py-2 border-b border-surface-300/80 last:border-0">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">{item.title || item.name || 'Untitled'}</p>
                    <p className="text-xs text-surface-500 truncate">{item.category || 'Uncategorized'}</p>
                  </div>
                  <span className={`badge ${item.status === 'active' ? 'badge-green' : item.status === 'pending' ? 'badge-yellow' : 'badge-gray'}`}>
                    {item.status || 'unknown'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-surface-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Platform Health
          </h3>
          <div className="space-y-3">
            {[
              {
                label: 'API Status',
                value: health.api === 'online' ? 'Online' : health.api === 'offline' ? 'Offline' : 'Checking…',
                icon: CheckCircle,
                color: health.api === 'online' ? 'text-emerald-600' : health.api === 'offline' ? 'text-red-600' : 'text-accent-600',
              },
              {
                label: 'Open Reports',
                value: health.openReports?.toLocaleString() ?? '—',
                icon: AlertTriangle,
                color: (health.openReports ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-surface-300/80 last:border-0">
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <span className="text-sm text-surface-700">{label}</span>
                </div>
                <span className={`text-sm font-medium ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
