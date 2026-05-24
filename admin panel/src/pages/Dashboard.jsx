import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import StatCard from '../components/StatCard'
import { LoadingSpinner, ErrorState } from '../components/States'
import {
  Package, Users, FileText, Star, Flag,
  TrendingUp, Clock, CheckCircle, AlertTriangle,
} from 'lucide-react'
import { itemsApi, usersApi, requestsApi, reviewsApi } from '../lib/api'

const RECENT_ITEMS_COUNT = 5

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats]     = useState(null)
  const [recent, setRecent]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [itemsRes, usersRes, requestsRes, reviewsRes] = await Promise.allSettled([
          itemsApi.list({ limit: RECENT_ITEMS_COUNT }),
          usersApi.list({ limit: 1 }),
          requestsApi.list({ limit: 1 }),
          reviewsApi.list({ limit: 1 }),
        ])

        const items    = itemsRes.status    === 'fulfilled' ? itemsRes.value.data    : { items: [], total: 0 }
        const users    = usersRes.status    === 'fulfilled' ? usersRes.value.data    : { total: 0 }
        const requests = requestsRes.status === 'fulfilled' ? requestsRes.value.data : { total: 0 }
        const reviews  = reviewsRes.status  === 'fulfilled' ? reviewsRes.value.data  : { total: 0 }

        setStats({
          totalItems:    items.total    ?? (Array.isArray(items) ? items.length : 0),
          totalUsers:    users.total    ?? (Array.isArray(users) ? users.length : 0),
          totalRequests: requests.total ?? (Array.isArray(requests) ? requests.length : 0),
          totalReviews:  reviews.total  ?? (Array.isArray(reviews) ? reviews.length : 0),
        })
        setRecent(Array.isArray(items.items) ? items.items : (Array.isArray(items) ? items.slice(0, 5) : []))
      } catch (err) {
        setError(err.message)
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

  if (loading) return <LoadingSpinner message="Loading dashboard…" />
  if (error)   return <ErrorState message={error} onRetry={() => window.location.reload()} />

  return (
    <div className="animate-slide-in">
      {/* Greeting */}
      <div className="page-header">
        <h2 className="page-title">
          {greeting},{' '}
          <span className="text-gradient">
            {user?.full_name?.split(' ')[0] || user?.username || 'Admin'}
          </span>
        </h2>
        <p className="page-subtitle">
          Here's what's happening on the platform today.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard
          label="Total Listings"
          value={stats?.totalItems?.toLocaleString() ?? '—'}
          icon={Package}
          color="brand"
          trend="+8%"
          sub="Active items on platform"
        />
        <StatCard
          label="Registered Users"
          value={stats?.totalUsers?.toLocaleString() ?? '—'}
          icon={Users}
          color="emerald"
          trend="+12%"
          sub="Total accounts"
        />
        <StatCard
          label="Open Requests"
          value={stats?.totalRequests?.toLocaleString() ?? '—'}
          icon={FileText}
          color="amber"
          sub="Pending exchanges"
        />
        <StatCard
          label="Reviews"
          value={stats?.totalReviews?.toLocaleString() ?? '—'}
          icon={Star}
          color="purple"
          trend="+3%"
          sub="Platform feedback"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Listings */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-surface-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              Recent Listings
            </h3>
            <a href="/listings" className="text-xs text-brand-600 hover:text-brand-700 transition-colors">
              View all →
            </a>
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
                    <p className="text-sm font-medium text-surface-800 truncate">
                      {item.title || item.name || 'Untitled'}
                    </p>
                    <p className="text-xs text-surface-500 truncate">
                      {item.category || 'Uncategorized'}
                    </p>
                  </div>
                  <span className={`badge ${item.status === 'active' ? 'badge-green' : item.status === 'pending' ? 'badge-yellow' : 'badge-gray'}`}>
                    {item.status || 'unknown'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats Panel */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-surface-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Platform Health
          </h3>
          <div className="space-y-3">
            {[
              { label: 'API Status',     value: 'Online',  icon: CheckCircle, color: 'text-emerald-600' },
              { label: 'Pending Reviews', value: 'Check',  icon: Clock,       color: 'text-accent-600'  },
              { label: 'Open Reports',   value: 'Review',  icon: Flag,        color: 'text-red-600'    },
              { label: 'System Alerts',  value: 'None',    icon: AlertTriangle, color: 'text-surface-500' },
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
