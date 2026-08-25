import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, RefreshCw, Search } from 'lucide-react'

import { shippingAdminApi } from '../lib/api'
import { resolveApiError } from '../lib/backend'
import {
  formatExchangeDate,
  formatShippingStatus,
  shippingStatusBadgeClass,
  shortId,
} from '../lib/exchanges'
import { EmptyState, ErrorState, LoadingSpinner } from '../components/States'

export default function ShippingPage() {
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const fetchShipments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await shippingAdminApi.list({ q: search, transaction_type: typeFilter })
      setShipments(Array.isArray(res.data?.shipments) ? res.data.shipments : [])
    } catch (err) {
      setError(resolveApiError(err, 'Unable to load shipments.'))
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter])

  useEffect(() => {
    fetchShipments()
  }, [fetchShipments])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Shipping Management</h2>
          <p className="text-sm text-surface-500">Give Away and Exchange shipments. Private addresses stay on this admin view.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={fetchShipments}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            className="input pl-9"
            placeholder="Search shipment ID, tracking, or user"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select className="input w-44" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="">All types</option>
          <option value="EXCHANGE">Exchange</option>
          <option value="GIVEAWAY">Give Away</option>
        </select>
      </div>

      {loading ? <LoadingSpinner message="Loading shipments…" /> : null}
      {error ? <ErrorState title="Could not load shipments" description={error} /> : null}
      {!loading && !error && shipments.length === 0 ? (
        <EmptyState icon={Package} title="No shipments" description="Shipments appear after an exchange is accepted or a Give Away request is approved." />
      ) : null}

      {!loading && shipments.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-50 text-xs uppercase tracking-wider text-surface-500">
              <tr>
                <th className="px-4 py-3">Shipment</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Carrier / Tracking</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((row) => (
                <tr key={row.id} className="border-t border-surface-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-surface-800">#{shortId(row.id)}</p>
                    <p className="text-xs text-surface-500">{row.item_title || 'Item'}</p>
                  </td>
                  <td className="px-4 py-3">{row.transaction_type || 'EXCHANGE'}</td>
                  <td className="px-4 py-3">
                    {row.sender_user_name || 'Sender'} → {row.receiver_user_name || 'Receiver'}
                  </td>
                  <td className="px-4 py-3">
                    <p>{row.carrier || '—'}</p>
                    <p className="text-xs text-surface-500">{row.tracking_number || 'No tracking yet'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${shippingStatusBadgeClass(row.shipping_status)}`}>
                      {row.status_label || formatShippingStatus(row.shipping_status)}
                    </span>
                    <p className="mt-1 text-xs text-surface-400">{formatExchangeDate(row.updated_at)}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.transaction_type === 'GIVEAWAY' ? (
                      <Link to={`/shipping`} className="btn-secondary py-1.5 px-3 text-xs">Give Away</Link>
                    ) : (
                      <Link to={`/exchanges/${row.transaction_id}`} className="btn-secondary py-1.5 px-3 text-xs">Open pair</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
