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

const PAGE_SIZE = 20

export default function ExchangesPage() {
  const [transactions, setTransactions] = useState([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const fetchTransactions = useCallback(async (nextSkip = skip) => {
    setLoading(true)
    setError('')
    try {
      const res = await exchangeAdminApi.listTransactions({
        skip: nextSkip,
        limit: PAGE_SIZE,
      })
      const data = res.data
      setTransactions(Array.isArray(data?.transactions) ? data.transactions : [])
      setTotal(typeof data?.total === 'number' ? data.total : 0)
      setSkip(typeof data?.skip === 'number' ? data.skip : nextSkip)
    } catch (err) {
      setError(resolveApiError(err, 'Unable to load exchange transactions.'))
      setTransactions([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [skip])

  useEffect(() => {
    fetchTransactions(0)
    // Initial load only; pagination buttons call fetchTransactions explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const pageStart = total === 0 ? 0 : skip + 1
  const pageEnd = Math.min(skip + PAGE_SIZE, total)
  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div className="animate-slide-in">
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="page-title">Exchange Shipping</h2>
          <p className="page-subtitle">Manage swap transactions, shipping legs, and tracking</p>
        </div>
        <button
          type="button"
          onClick={() => fetchTransactions(skip)}
          className="btn-secondary px-3 py-1.5 flex items-center gap-2 w-fit"
        >
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
            placeholder="Search this page by listing, user, or ID"
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
        <ErrorState message={error} onRetry={() => fetchTransactions(skip)} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No exchange transactions"
          description="Accepted swaps will appear here for shipping coordination."
        />
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-surface-500">
            <p>
              Showing {pageStart}–{pageEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 disabled:opacity-50"
                disabled={!canPrev || loading}
                onClick={() => fetchTransactions(Math.max(0, skip - PAGE_SIZE))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 disabled:opacity-50"
                disabled={!canNext || loading}
                onClick={() => fetchTransactions(skip + PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          </div>

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
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const summary = shippingPaymentSummary(tx.shipping_records)
                  return (
                    <tr key={tx.id} className="border-b border-surface-200 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-surface-500">{shortId(tx.id)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {tx.listing_image_url ? (
                            <img
                              src={tx.listing_image_url}
                              alt=""
                              className="h-10 w-10 rounded-lg object-cover border border-surface-200"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100 border border-surface-200">
                              <ArrowLeftRight className="h-4 w-4 text-surface-400" />
                            </div>
                          )}
                          <span className="font-medium text-surface-800">{tx.listing_title || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-surface-600">
                        <p>{tx.user_a_name || '—'}</p>
                        <p className="text-xs text-surface-400">{tx.user_b_name || '—'}</p>
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
                      <td className="px-4 py-3 text-surface-500">{formatExchangeDate(tx.updated_at || tx.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/exchanges/${tx.id}`} className="btn-ghost inline-flex items-center gap-1.5 px-2 py-1">
                          <Eye className="h-3.5 w-3.5" />
                          Open
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((tx) => {
              const summary = shippingPaymentSummary(tx.shipping_records)
              return (
                <Link
                  key={tx.id}
                  to={`/exchanges/${tx.id}`}
                  className="block rounded-xl border border-surface-300 bg-white p-4 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-surface-800">{tx.listing_title || '—'}</p>
                      <p className="mt-1 text-xs text-surface-500">{shortId(tx.id)}</p>
                    </div>
                    <span className={`badge ${exchangeStatusBadgeClass(tx.status)}`}>
                      {formatExchangeStatus(tx.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-surface-600">
                    {tx.user_a_name || '—'} ↔ {tx.user_b_name || '—'}
                  </p>
                  <p className="mt-1 text-xs text-surface-500">{summary.shipping} · {summary.payment}</p>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
