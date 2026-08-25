import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Package, RefreshCw, Truck } from 'lucide-react'

import ConfirmDialog from '../components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingSpinner } from '../components/States'
import { exchangeAdminApi } from '../lib/api'
import { resolveApiError } from '../lib/backend'
import {
  EXCHANGE_PAYMENT_STATUSES,
  EXCHANGE_SHIPPING_STATUSES,
  exchangeStatusBadgeClass,
  formatExchangeDate,
  formatExchangeStatus,
  formatPaymentStatus,
  formatShippingStatus,
  isTerminalExchangeStatus,
  shippingStatusBadgeClass,
  shortId,
} from '../lib/exchanges'

function receiverName(record, transaction) {
  if (!transaction) return 'Partner'
  if (record.receiver_user_id === transaction.user_a_id) return transaction.user_a_name || 'User A'
  if (record.receiver_user_id === transaction.user_b_id) return transaction.user_b_name || 'User B'
  return 'Partner'
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-surface-500">{label}</span>
      {children}
    </label>
  )
}

function ShippingLegForm({
  record,
  transaction,
  details,
  loadingDetails,
  saving,
  onSave,
}) {
  const [form, setForm] = useState({
    shipping_cost: record.shipping_cost ?? '',
    shipping_status: record.shipping_status || 'awaiting_details',
    payment_status: record.payment_status || 'pending',
    tracking_number: record.tracking_number || '',
    tracking_url: record.tracking_url || '',
    carrier: record.carrier || '',
    estimated_delivery: record.estimated_delivery ? String(record.estimated_delivery).slice(0, 10) : '',
    admin_instructions: record.admin_instructions || '',
    admin_notes: details?.admin_notes || '',
  })

  useEffect(() => {
    setForm({
      shipping_cost: record.shipping_cost ?? '',
      shipping_status: record.shipping_status || 'awaiting_details',
      payment_status: record.payment_status || 'pending',
      tracking_number: record.tracking_number || '',
      tracking_url: record.tracking_url || '',
      carrier: record.carrier || '',
      estimated_delivery: record.estimated_delivery ? String(record.estimated_delivery).slice(0, 10) : '',
      admin_instructions: record.admin_instructions || '',
      admin_notes: details?.admin_notes || '',
    })
  }, [record, details])

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const handleSubmit = (event) => {
    event.preventDefault()
    const payload = {
      shipping_status: form.shipping_status,
      payment_status: form.payment_status,
      tracking_number: form.tracking_number.trim() || null,
      tracking_url: form.tracking_url.trim() || null,
      carrier: form.carrier.trim() || null,
      estimated_delivery: form.estimated_delivery || null,
      admin_instructions: form.admin_instructions.trim() || null,
      admin_notes: form.admin_notes.trim() || null,
    }
    if (form.shipping_cost === '' || form.shipping_cost == null) {
      payload.shipping_cost = null
    } else {
      payload.shipping_cost = Number(form.shipping_cost)
    }
    onSave(record.id, payload)
  }

  const addressLines = [
    details?.full_name,
    details?.phone_number,
    details?.address_line1,
    details?.address_line2,
    [details?.city, details?.state, details?.postal_code].filter(Boolean).join(', '),
    details?.country,
  ].filter(Boolean)

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">
            {record.sender_user_name || 'Sender'} → {receiverName(record, transaction)}
          </p>
          <h3 className="font-semibold text-surface-800">
            {record.sender_user_name || 'User'} → {receiverName(record, transaction)}
          </h3>
        </div>
        <span className={`badge ${shippingStatusBadgeClass(record.shipping_status)}`}>
          {formatShippingStatus(record.shipping_status)}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-surface-500">Sender</dt>
          <dd className="text-surface-800">{record.sender_user_name || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-surface-500">Receiver ID</dt>
          <dd className="text-surface-800">{receiverName(record, transaction)}</dd>
        </div>
        <div>
          <dt className="text-xs text-surface-500">Payment</dt>
          <dd>{formatPaymentStatus(record.payment_status)}</dd>
        </div>
        <div>
          <dt className="text-xs text-surface-500">Cost</dt>
          <dd>{record.shipping_cost == null ? 'Not set' : record.shipping_cost}</dd>
        </div>
      </dl>

      <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">Protected shipping details</p>
        {loadingDetails ? (
          <p className="mt-2 text-xs text-surface-500">Loading authorized address…</p>
        ) : addressLines.length === 0 ? (
          <p className="mt-2 text-sm text-surface-500">No shipping address submitted yet.</p>
        ) : (
          <div className="mt-2 space-y-0.5 text-sm text-surface-800">
            {addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {details?.notes ? <p className="pt-1 text-surface-600">Notes: {details.notes}</p> : null}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Shipping cost">
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            value={form.shipping_cost}
            onChange={(event) => update('shipping_cost', event.target.value)}
          />
        </Field>
        <Field label="Shipping status">
          <select
            className="input"
            value={form.shipping_status}
            onChange={(event) => update('shipping_status', event.target.value)}
          >
            {EXCHANGE_SHIPPING_STATUSES.map((value) => (
              <option key={value} value={value}>{formatShippingStatus(value)}</option>
            ))}
          </select>
        </Field>
        <Field label="Payment status">
          <select
            className="input"
            value={form.payment_status}
            onChange={(event) => update('payment_status', event.target.value)}
          >
            {EXCHANGE_PAYMENT_STATUSES.map((value) => (
              <option key={value} value={value}>{formatPaymentStatus(value)}</option>
            ))}
          </select>
        </Field>
        <Field label="Carrier">
          <input
            className="input"
            value={form.carrier}
            onChange={(event) => update('carrier', event.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Tracking number">
            <input
              className="input"
              value={form.tracking_number}
              onChange={(event) => update('tracking_number', event.target.value)}
            />
          </Field>
        </div>
        <Field label="Estimated delivery">
          <input
            type="date"
            className="input"
            value={form.estimated_delivery}
            onChange={(event) => update('estimated_delivery', event.target.value)}
          />
        </Field>
        <Field label="Tracking URL">
          <input
            className="input"
            value={form.tracking_url}
            onChange={(event) => update('tracking_url', event.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Admin instructions">
            <textarea
              className="input min-h-[88px]"
              value={form.admin_instructions}
              onChange={(event) => update('admin_instructions', event.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Admin notes">
            <textarea
              className="input min-h-[88px]"
              value={form.admin_notes}
              onChange={(event) => update('admin_notes', event.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save shipping updates'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default function ExchangeDetailPage() {
  const { transactionId } = useParams()
  const [transaction, setTransaction] = useState(null)
  const [shippingDetails, setShippingDetails] = useState({})
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [savingId, setSavingId] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)
  const [pendingShipping, setPendingShipping] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const showToast = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 4000)
  }

  const loadProtectedShipping = useCallback(async (records) => {
    setDetailsLoading(true)
    const next = {}
    await Promise.all((records || []).map(async (record) => {
      try {
        const res = await exchangeAdminApi.getShipping(record.id)
        next[record.id] = res.data
      } catch {
        next[record.id] = null
      }
    }))
    setShippingDetails(next)
    setDetailsLoading(false)
  }, [])

  const fetchTransaction = useCallback(async () => {
    if (!transactionId) return
    setLoading(true)
    setError('')
    try {
      const res = await exchangeAdminApi.getTransaction(transactionId)
      setTransaction(res.data)
      await loadProtectedShipping(res.data?.shipping_records || [])
    } catch (err) {
      setError(resolveApiError(err, 'Unable to load this exchange.'))
      setTransaction(null)
    } finally {
      setLoading(false)
    }
  }, [transactionId, loadProtectedShipping])

  useEffect(() => {
    fetchTransaction()
  }, [fetchTransaction])

  const handleSaveShipping = async (shippingId, payload) => {
    if (payload.shipping_status === 'delivered') {
      setPendingShipping({ shippingId, payload })
      return
    }
    await persistShipping(shippingId, payload)
  }

  const persistShipping = async (shippingId, payload) => {
    setSavingId(shippingId)
    try {
      await exchangeAdminApi.updateShipping(shippingId, payload)
      showToast('Shipping details updated.')
      await fetchTransaction()
    } catch (err) {
      showToast(resolveApiError(err, 'Unable to update shipping.'))
    } finally {
      setSavingId('')
    }
  }

  const handleStatusChange = async () => {
    if (!confirmAction || !transactionId) return
    setConfirmLoading(true)
    try {
      await exchangeAdminApi.updateTransactionStatus(transactionId, confirmAction)
      showToast(`Exchange marked ${formatExchangeStatus(confirmAction)}.`)
      setConfirmAction(null)
      await fetchTransaction()
    } catch (err) {
      showToast(resolveApiError(err, 'Unable to update exchange status.'))
    } finally {
      setConfirmLoading(false)
    }
  }

  if (loading) return <LoadingSpinner message="Loading exchange…" />
  if (error) return <ErrorState message={error} onRetry={fetchTransaction} />
  if (!transaction) {
    return (
      <EmptyState
        icon={Package}
        title="Exchange not found"
        description="This exchange transaction could not be loaded."
      />
    )
  }

  const terminal = isTerminalExchangeStatus(transaction.status)

  return (
    <div className="animate-slide-in space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/exchanges" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to exchanges
          </Link>
          <h2 className="page-title">{transaction.listing_title || 'Exchange'}</h2>
          <p className="page-subtitle font-mono">#{shortId(transaction.id)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={fetchTransaction} className="btn-secondary px-3 py-1.5 flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          {!terminal ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => setConfirmAction('EXPIRED')}>
                Expire exchange
              </button>
              <button type="button" className="btn-danger" onClick={() => setConfirmAction('CANCELLED')}>
                Cancel exchange
              </button>
            </>
          ) : null}
        </div>
      </div>

      {toast ? <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">{toast}</p> : null}

      <section className="card grid grid-cols-1 gap-4 md:grid-cols-[auto,1fr]">
        {transaction.listing_image_url ? (
          <img
            src={transaction.listing_image_url}
            alt={transaction.listing_title || 'Listing'}
            className="h-28 w-28 rounded-xl object-cover border border-surface-200"
          />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-surface-200 bg-surface-50">
            <Package className="h-6 w-6 text-surface-400" />
          </div>
        )}
        <div className="space-y-2">
          <span className={`badge ${exchangeStatusBadgeClass(transaction.status)}`}>
            {formatExchangeStatus(transaction.status)}
          </span>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-surface-500">User A</dt>
              <dd className="font-medium text-surface-800">{transaction.user_a_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-surface-500">User B</dt>
              <dd className="font-medium text-surface-800">{transaction.user_b_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-surface-500">Created</dt>
              <dd>{formatExchangeDate(transaction.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-surface-500">Completed</dt>
              <dd>{formatExchangeDate(transaction.completed_at)}</dd>
            </div>
          </dl>
          <div className="rounded-lg bg-surface-50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">Offered item</p>
            <div className="mt-1 flex items-center gap-3">
              {transaction.offered_item_image ? (
                <img src={transaction.offered_item_image} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : null}
              <p className="text-surface-800">{transaction.offered_item_title || 'See original offer'}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-brand-600" />
        <h3 className="font-semibold text-surface-800">Shipping legs</h3>
      </div>

      {(transaction.shipping_records || []).length === 0 ? (
        <EmptyState title="No shipping records" description="Shipping legs appear after an exchange is accepted." />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {(transaction.shipping_records || []).map((record) => (
            <ShippingLegForm
              key={record.id}
              record={record}
              transaction={transaction}
              details={shippingDetails[record.id]}
              loadingDetails={detailsLoading}
              saving={savingId === record.id}
              onSave={handleSaveShipping}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction === 'CANCELLED' ? 'Cancel this exchange?' : 'Expire this exchange?'}
        message="The listing will be released and paused offers can become available again. This cannot be undone from this screen."
        confirmLabel={confirmAction === 'CANCELLED' ? 'Cancel exchange' : 'Expire exchange'}
        danger
        loading={confirmLoading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleStatusChange}
      />
      <ConfirmDialog
        open={Boolean(pendingShipping)}
        title="Mark this shipment delivered?"
        message="This updates the shipping status to delivered for this leg."
        confirmLabel="Mark delivered"
        loading={savingId === pendingShipping?.shippingId}
        onCancel={() => setPendingShipping(null)}
        onConfirm={async () => {
          const pending = pendingShipping
          setPendingShipping(null)
          if (pending) await persistShipping(pending.shippingId, pending.payload)
        }}
      />
    </div>
  )
}
