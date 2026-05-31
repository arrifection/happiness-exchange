import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useApiHealth } from '../contexts/ApiHealthContext'
import StatCard from '../components/StatCard'
import ConfirmDialog from '../components/ConfirmDialog'
import ListingDetailModal from '../components/ListingDetailModal'
import ListingThumbnail from '../components/ListingThumbnail'
import { LoadingSpinner, ErrorState } from '../components/States'
import {
  Package, Users, FileText, Star, TrendingUp, CheckCircle, AlertTriangle, Eye, Trash2,
} from 'lucide-react'
import { analyticsApi, itemsApi, reportsApi } from '../lib/api'
import { resolveApiError } from '../lib/backend'
import {
  formatListingDate,
  getListingId,
  getListingOwnerLabel,
  getListingStatusBadgeClass,
} from '../lib/listings'

const RECENT_ITEMS_COUNT = 5

export default function DashboardPage() {
  const { user } = useAuth()
  const { status: apiStatus, signalDataSuccess } = useApiHealth()
  const [stats, setStats]     = useState(null)
  const [recent, setRecent]   = useState([])
  const [openReports, setOpenReports] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [toast, setToast]     = useState('')
  const [viewItem, setViewItem] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const showToast = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 4000)
  }

  const loadDashboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryRes, itemsRes, reportsRes] = await Promise.all([
        analyticsApi.summary(),
        itemsApi.list({ limit: RECENT_ITEMS_COUNT }),
        reportsApi.list({ status: 'open', limit: 1 }),
      ])

      // Signal shared health context — data loaded = backend is reachable.
      signalDataSuccess()

      const summary = summaryRes.data
      setOpenReports(reportsRes.data.total ?? 0)
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

  useEffect(() => {
    loadDashboard()
  }, [])

  const handleDeleteListing = async () => {
    const itemId = getListingId(deleteTarget)
    if (!itemId) return

    setDeleteLoading(true)
    try {
      await itemsApi.delete(itemId)
      setRecent((current) => current.filter((item) => getListingId(item) !== itemId))
      setStats((current) => current ? { ...current, totalItems: Math.max(0, (current.totalItems || 0) - 1) } : current)
      showToast('Listing deleted successfully.')
      setDeleteTarget(null)
    } catch (err) {
      showToast(resolveApiError(err, 'Delete failed.'))
    } finally {
      setDeleteLoading(false)
    }
  }

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
  if (error)   return <ErrorState message={error} onRetry={loadDashboard} />

  return (
    <div className="animate-slide-in">
      {toast ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {toast}
        </div>
      ) : null}

      <div className="page-header">
        <h2 className="page-title">
          {greeting},{' '}
          <span className="text-gradient">{displayName}</span>
        </h2>
        <p className="page-subtitle">Live platform data from the production backend.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard label="Total Listings" value={stats?.totalItems?.toLocaleString() ?? '—'} icon={Package} color="brand" sub="All items on platform" to="/listings" />
        <StatCard label="Registered Users" value={stats?.totalUsers?.toLocaleString() ?? '—'} icon={Users} color="emerald" sub="Total accounts" to="/users" />
        <StatCard label="Open Requests" value={stats?.totalRequests?.toLocaleString() ?? '—'} icon={FileText} color="amber" sub="Pending exchanges" to="/requests" />
        <StatCard label="Reviews" value={stats?.totalReviews?.toLocaleString() ?? '—'} icon={Star} color="purple" sub="Platform feedback" to="/reviews" />
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
              {recent.map((item) => (
                <div key={getListingId(item)} className="flex items-center gap-4 rounded-xl border border-surface-300/80 px-3 py-3">
                  <ListingThumbnail item={item} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">{item.title || item.name || 'Untitled'}</p>
                    <p className="text-xs text-surface-500 truncate">
                      {item.category || 'Uncategorized'} · {getListingOwnerLabel(item)}
                    </p>
                    <p className="text-[11px] text-surface-400 mt-0.5">{formatListingDate(item.created_at)}</p>
                  </div>
                  <span className={`badge ${getListingStatusBadgeClass(item.status)}`}>
                    {item.status || 'unknown'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn-icon btn-ghost"
                      title="View listing"
                      onClick={() => setViewItem(item)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-danger"
                      title="Delete listing"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
                value: apiStatus === 'online' ? 'Online' : apiStatus === 'offline' ? 'Offline' : 'Checking…',
                icon: CheckCircle,
                color: apiStatus === 'online' ? 'text-emerald-600' : apiStatus === 'offline' ? 'text-red-600' : 'text-accent-600',
              },
              {
                label: 'Open Reports',
                value: openReports?.toLocaleString() ?? '—',
                icon: AlertTriangle,
                color: (openReports ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600',
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
        onConfirm={handleDeleteListing}
      />
    </div>
  )
}
