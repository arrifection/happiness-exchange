import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, Eye, RefreshCw, Search } from 'lucide-react'

import { exchangeAdminApi } from '../lib/api'
import { resolveApiError } from '../lib/backend'
import {
  exchangeStatusBadgeClass,
  formatExchangeDate,
  formatExchangeStatus,
  shippingPaymentSummary,
  shortId,
} from '../lib/exchanges'
import { EmptyState, ErrorState, LoadingSpinner } from '../components/States'

export default function ExchangesPage() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await exchangeAdminApi.listTransactions()
      const data = res.data
      setTransactions(Array.isArray(data?.transactions) ? data.transactions : [])
    } catch (err) {
      setError(resolveApiError(err, 'Unable to load exchange transactions.'))
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return transactions.filter((tx) => {
      if (status !== 'all' && tx.status !== status) return false
      if (!query) return true
      const haystack = [
        tx.id,
        tx.listing_title,
        tx.user_a_name,
        tx.user_b_name,
        tx.status,
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [transactions, search, status])

  const statuses = useMemo(
    () => ['all', ...Array.from(new Set(transactions.map((tx) => tx.status).filter(Boolean)))],
    [transactions],
  )

  return (
    <div className="animate-slide-in">
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="page-title">Exchange Shipping</h2>
          <p className="page-subtitle">Manage swap transactions, shipping legs, and tracking</p>
        </div>
        <button type="button" onClick={fetchTransactions} className="btn-secondary px-3 py-1.5 flex items-center gap-2 w-fit">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by listing, user, or ID"
            className="input pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="input sm:w-56"
        >
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value === 'all' ? 'All statuses' : formatExchangeStatus(value)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading exchanges…" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTransactions} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No exchange transactions"
          description="Accepted swaps will appear here for shipping coordination."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-surface-300 bg-white shadow-soft md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-300 text-left text-xs uppercase tracking-wider text-surface-500">
                  <th className="px-4 py-3">Exchange</th>
                  <th className="px-4 py-3">Listing</th>
                  <th className="px-4 py-3">Users</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Shipping / Payment</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const summary = shippingPaymentSummary(tx.shipping_records)
                  return (
                    <tr key={tx.id} className="border-b border-surface-200 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-surface-600">#{shortId(tx.id)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-surface-800">{tx.listing_title || '—'}</p>
                        <p className="text-xs text-surface-400">{formatExchangeDate(tx.created_at)}</p>
                      </td>
                      <td className="px-4 py-3 text-surface-700">
                        <p>{tx.user_a_name || 'User A'}</p>
                        <p className="text-xs text-surface-500">{tx.user_b_name || 'User B'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${exchangeStatusBadgeClass(tx.status)}`}>
                          {formatExchangeStatus(tx.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-surface-600">
                        <p>{summary.shipping}</p>
                        <p>{summary.payment}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-surface-600">
                        {formatExchangeDate(tx.updated_at || tx.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/exchanges/${tx.id}`} className="btn-secondary py-1.5 px-3 text-xs inline-flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filtered.map((tx) => {
              const summary = shippingPaymentSummary(tx.shipping_records)
              return (
                <article key={tx.id} className="card space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-surface-500">#{shortId(tx.id)}</p>
                      <p className="font-semibold text-surface-800">{tx.listing_title || '—'}</p>
                    </div>
                    <span className={`badge ${exchangeStatusBadgeClass(tx.status)}`}>
                      {formatExchangeStatus(tx.status)}
                    </span>
                  </div>
                  <p className="text-sm text-surface-600">
                    {tx.user_a_name || 'User A'} ↔ {tx.user_b_name || 'User B'}
                  </p>
                  <p className="text-xs text-surface-500">{summary.shipping} · {summary.payment}</p>
                  <p className="text-xs text-surface-400">Updated {formatExchangeDate(tx.updated_at || tx.created_at)}</p>
                  <Link to={`/exchanges/${tx.id}`} className="btn-primary text-xs py-1.5 px-3 w-fit inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Link>
                </article>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
