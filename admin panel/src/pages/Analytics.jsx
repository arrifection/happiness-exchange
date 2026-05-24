import { useEffect, useState } from 'react'
import { Users, Package, FileText, Star, Activity } from 'lucide-react'
import { analyticsApi } from '../lib/api'
import { LoadingSpinner, ErrorState } from '../components/States'
import StatCard from '../components/StatCard'
import { resolveApiError } from '../lib/backend'

export default function AnalyticsPage() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await analyticsApi.summary()
        setSummary(res.data)
      } catch (err) {
        setError(resolveApiError(err))
      } finally {
        setLoading(false)
      }
    }
    fetchSummary()
  }, [])

  if (loading) return <LoadingSpinner message="Loading analytics…" />
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />

  const openRequests = summary.requests?.open ?? 0
  const totalRequests = summary.requests?.total ?? 0
  const successRate = totalRequests > 0
    ? Math.round(((totalRequests - openRequests) / totalRequests) * 100)
    : 0

  return (
    <div className="animate-slide-in">
      <div className="page-header">
        <h2 className="page-title">Analytics</h2>
        <p className="page-subtitle">Live counts from the production database.</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard label="Total Listings" value={(summary.items?.total ?? 0).toLocaleString()} icon={Package} color="brand" sub={`${summary.items?.active ?? 0} active`} />
        <StatCard label="Total Users" value={(summary.users?.total ?? 0).toLocaleString()} icon={Users} color="emerald" sub={`${summary.users?.banned ?? 0} banned`} />
        <StatCard label="Exchange Requests" value={totalRequests.toLocaleString()} icon={FileText} color="amber" sub={`${openRequests} open`} />
        <StatCard label="Completion Rate" value={`${successRate}%`} icon={Activity} color="purple" sub="Resolved vs total requests" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-brand-600" />
            Listings
          </h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-surface-500">Total</dt><dd className="font-semibold text-surface-800">{summary.items?.total ?? 0}</dd></div>
            <div className="flex justify-between"><dt className="text-surface-500">Active</dt><dd className="font-semibold text-surface-800">{summary.items?.active ?? 0}</dd></div>
            <div className="flex justify-between"><dt className="text-surface-500">Completed</dt><dd className="font-semibold text-surface-800">{summary.items?.completed ?? 0}</dd></div>
          </dl>
        </div>
        <div className="card">
          <h3 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-purple-600" />
            Reviews & Requests
          </h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-surface-500">Total reviews</dt><dd className="font-semibold text-surface-800">{summary.reviews?.total ?? 0}</dd></div>
            <div className="flex justify-between"><dt className="text-surface-500">Open requests</dt><dd className="font-semibold text-surface-800">{openRequests}</dd></div>
            <div className="flex justify-between"><dt className="text-surface-500">Total requests</dt><dd className="font-semibold text-surface-800">{totalRequests}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  )
}
