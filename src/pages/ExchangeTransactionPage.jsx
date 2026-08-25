import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { Button, StatusBadge, TextAreaField, TextField } from '../components/ui.jsx'
import { apiUrl } from '../lib/api.js'
import {
  exchangeProgressSteps,
  paymentStatusLabel,
  shippingStatusLabel,
  transactionStatusLabel,
} from '../lib/exchangeStatus.js'
import { formatEstimatedDelivery } from '../lib/shippingStatus.js'
import { resolveItemImageUrl } from '../lib/itemImages.js'

function ExchangeProgress({ status }) {
  const steps = exchangeProgressSteps(status)
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const isDone = step.state === 'done'
        const isCurrent = step.state === 'current'
        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                  isDone
                    ? 'border-he-purple bg-he-purple text-white'
                    : isCurrent
                      ? 'border-he-purple bg-he-surface text-he-purple'
                      : 'border-he-border bg-he-surface text-he-soft'
                }`}
              >
                {isDone ? '✓' : index + 1}
              </div>
              {index < steps.length - 1 ? (
                <div className={`w-0.5 flex-1 min-h-4 ${isDone ? 'bg-he-purple' : 'bg-he-border'}`} />
              ) : null}
            </div>
            <p
              className={`pb-4 pt-0.5 text-sm ${
                isDone || isCurrent ? 'font-bold text-he-ink' : 'text-he-muted'
              }`}
            >
              {step.label}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

function ItemSnapshot({ title, imageUrl, description, condition, cashAdjustment, eyebrow }) {
  return (
    <div className="flex gap-3 rounded-xl bg-he-surface-soft p-3">
      <img
        src={resolveItemImageUrl(imageUrl)}
        alt=""
        className="h-20 w-20 shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0">
        {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-widest text-he-soft">{eyebrow}</p> : null}
        <p className="font-bold text-he-ink">{title || 'Item'}</p>
        {condition ? <p className="text-xs text-he-muted">Condition: {condition}</p> : null}
        {description ? <p className="mt-1 line-clamp-3 text-sm text-he-muted">{description}</p> : null}
        {cashAdjustment != null && cashAdjustment !== '' ? (
          <p className="mt-1 text-xs font-bold text-he-purple">Cash adjustment: {cashAdjustment}</p>
        ) : null}
      </div>
    </div>
  )
}

export default function ExchangeTransactionPage({ currentUser, token }) {
  const { transactionId } = useParams()
  const [transaction, setTransaction] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [paymentReference, setPaymentReference] = useState('')
  const [shippingForm, setShippingForm] = useState({
    full_name: '',
    phone_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    notes: '',
  })

  async function loadTransaction() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(apiUrl(`/api/exchange-transactions/${transactionId}`), {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not load exchange.')
      setTransaction(data)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTransaction()
  }, [transactionId, token])

  if (!currentUser) return <Navigate to="/login" replace />

  const myShipping = transaction?.shipping_records?.find(
    (record) => record.sender_user_id === currentUser.id,
  )
  const partnerShipping = (transaction?.shipping_records || []).find(
    (record) => record.sender_user_id !== currentUser.id,
  )
  const partnerName = transaction
    ? (transaction.user_a_id === currentUser.id ? transaction.user_b_name : transaction.user_a_name)
    : ''
  const myName = transaction
    ? (transaction.user_a_id === currentUser.id ? transaction.user_a_name : transaction.user_b_name)
    : currentUser.name
  const isActive = transaction && !['COMPLETED', 'EXPIRED', 'CANCELLED'].includes(transaction.status)
  const canSubmitDetails = Boolean(isActive && myShipping?.shipping_status === 'awaiting_details')
  const paymentRequired = Boolean(
    isActive
    && myShipping
    && myShipping.shipping_status === 'awaiting_payment'
    && myShipping.payment_status !== 'paid',
  )
  const paymentDueLabel = myShipping?.payment_due_at
    ? new Date(myShipping.payment_due_at).toLocaleString()
    : null

  function updateShippingField(field) {
    return (event) => setShippingForm((current) => ({ ...current, [field]: event.target.value }))
  }

  async function submitShippingDetails(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(apiUrl(`/api/exchange-transactions/${transactionId}/shipping-details`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(shippingForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not save shipping details.')
      setTransaction(data)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function payShipping(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(apiUrl(`/api/exchange-transactions/${transactionId}/pay-shipping`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payment_reference: paymentReference }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Payment failed.')
      setTransaction(data)
    } catch (payError) {
      setError(payError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app-shell mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold text-he-ink">Exchange Progress</h1>
          <p className="text-sm text-he-muted">{transaction?.listing_title || 'Loading exchange…'}</p>
        </div>
        <Button as="link" to="/swaps" variant="ghost">Back to swaps</Button>
      </div>

      {loading ? <p className="text-sm text-he-muted">Loading…</p> : null}
      {error ? <p className="text-sm font-bold text-he-danger">{error}</p> : null}

      {transaction ? (
        <>
          <div className="rounded-2xl border border-he-border bg-he-surface p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={String(transaction.status).toLowerCase()} />
              <span className="text-sm font-bold text-he-ink">{transactionStatusLabel(transaction.status)}</span>
            </div>
            <ExchangeProgress status={transaction.status} />
            <p className="text-xs text-he-muted">
              Your private address and phone are never shown to the other user. Admin coordinates shipping.
            </p>
          </div>

          <div className="rounded-2xl border border-he-border bg-he-surface p-4 space-y-3">
            <h2 className="text-sm font-bold text-he-ink">Original listing</h2>
            <ItemSnapshot
              eyebrow="Listed item"
              title={transaction.listing_title}
              imageUrl={transaction.listing_image_url}
            />
            {transaction.listing_id ? (
              <Link className="text-xs font-bold text-he-purple hover:underline" to={`/items/${transaction.listing_id}`}>
                View listing
              </Link>
            ) : null}
          </div>

          <div className="rounded-2xl border border-he-border bg-he-surface p-4 space-y-3">
            <h2 className="text-sm font-bold text-he-ink">Offered item</h2>
            <ItemSnapshot
              eyebrow="Swap item"
              title={transaction.offered_item_title || 'Offered item'}
              imageUrl={transaction.offered_item_image}
              description={transaction.offered_item_description}
              condition={transaction.offered_item_condition}
              cashAdjustment={transaction.cash_adjustment}
            />
          </div>

          <div className="rounded-2xl border border-he-border bg-he-surface p-4 space-y-2">
            <h2 className="text-sm font-bold text-he-ink">Participants</h2>
            <p className="text-sm text-he-ink">You: {myName}</p>
            <p className="text-sm text-he-ink">Partner: {partnerName || 'Community Member'}</p>
          </div>

          {myShipping ? (
            <div className="rounded-2xl border border-he-border bg-he-surface p-4 space-y-3">
              <h2 className="text-sm font-bold text-he-ink">Your Shipment</h2>
              <p className="text-[12px] text-he-muted">
                Status: {myShipping.status_label || shippingStatusLabel(myShipping.shipping_status)} · {paymentStatusLabel(myShipping.payment_status)}
              </p>
              {myShipping.admin_instructions ? (
                <p className="rounded-lg bg-he-surface-soft p-3 text-sm text-he-ink">{myShipping.admin_instructions}</p>
              ) : null}
              {myShipping.tracking_number || myShipping.carrier ? (
                <div className="rounded-lg bg-he-surface-soft p-3 text-sm text-he-ink">
                  <p><span className="font-bold">Carrier:</span> {myShipping.carrier || 'Not listed yet'}</p>
                  <p>
                    <span className="font-bold">Tracking number:</span>{' '}
                    {myShipping.tracking_number ? (
                      <Link className="text-he-purple hover:underline" to={`/tracking/${myShipping.id}`}>
                        {myShipping.tracking_number}
                      </Link>
                    ) : 'Not listed yet'}
                  </p>
                  {myShipping.estimated_delivery ? (
                    <p><span className="font-bold">Estimated delivery:</span> {formatEstimatedDelivery(myShipping.estimated_delivery)}</p>
                  ) : null}
                  <Button as="link" to={`/tracking/${myShipping.id}`} variant="ghost" className="mt-2">Track shipment</Button>
                </div>
              ) : (
                <Button as="link" to={`/tracking/${myShipping.id}`} variant="ghost">Track shipment</Button>
              )}
              {myShipping.shipping_cost != null ? (
                <p className="text-sm font-bold text-he-purple">Shipping cost: {myShipping.shipping_cost}</p>
              ) : (
                <p className="text-xs text-he-muted">Shipping cost will appear here after admin confirms it.</p>
              )}
              {paymentDueLabel && paymentRequired ? (
                <p className="text-xs text-he-muted">Payment due by {paymentDueLabel}.</p>
              ) : null}

              {canSubmitDetails ? (
                <form className="space-y-2" onSubmit={submitShippingDetails}>
                  <p className="text-xs text-he-muted">Submit your own pickup/shipping details. The other user cannot see this information.</p>
                  <TextField label="Full name" value={shippingForm.full_name} onChange={updateShippingField('full_name')} required />
                  <TextField label="Phone number" value={shippingForm.phone_number} onChange={updateShippingField('phone_number')} required />
                  <TextField label="Address line 1" value={shippingForm.address_line1} onChange={updateShippingField('address_line1')} required />
                  <TextField label="Address line 2" value={shippingForm.address_line2} onChange={updateShippingField('address_line2')} />
                  <TextField label="City" value={shippingForm.city} onChange={updateShippingField('city')} required />
                  <TextField label="State" value={shippingForm.state} onChange={updateShippingField('state')} />
                  <TextField label="Postal code" value={shippingForm.postal_code} onChange={updateShippingField('postal_code')} required />
                  <TextField label="Country" value={shippingForm.country} onChange={updateShippingField('country')} required />
                  <TextAreaField label="Notes for admin (optional)" value={shippingForm.notes} onChange={updateShippingField('notes')} rows={3} />
                  <Button disabled={submitting} type="submit">Submit shipping details</Button>
                </form>
              ) : null}

              {paymentRequired ? (
                <form className="space-y-2" onSubmit={payShipping}>
                  <p className="text-sm font-bold text-he-ink">Shipping payment is required</p>
                  <p className="text-xs text-he-muted">
                    This records a platform payment reference. Card processing is not handled on this page.
                  </p>
                  <TextField
                    label="Platform payment reference"
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    placeholder="Receipt or transaction ID"
                    required
                  />
                  <Button disabled={submitting} type="submit">Submit payment reference</Button>
                </form>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-he-border bg-he-surface p-4 space-y-2">
            <h2 className="mb-2 text-sm font-bold text-he-ink">Other User's Shipment</h2>
            {partnerShipping ? (
              <div className="rounded-lg bg-he-surface-soft p-3 text-sm text-he-muted space-y-1">
                <p className="font-bold text-he-ink">{partnerShipping.item_title || partnerShipping.sender_user_name || partnerName}</p>
                <p>Status: {partnerShipping.status_label || shippingStatusLabel(partnerShipping.shipping_status)}</p>
                {partnerShipping.carrier ? <p>Carrier: {partnerShipping.carrier}</p> : null}
                {partnerShipping.tracking_number ? (
                  <p>
                    Tracking:{' '}
                    <Link className="font-bold text-he-purple hover:underline" to={`/tracking/${partnerShipping.id}`}>
                      {partnerShipping.tracking_number}
                    </Link>
                  </p>
                ) : null}
                {partnerShipping.estimated_delivery ? (
                  <p>Estimated delivery: {formatEstimatedDelivery(partnerShipping.estimated_delivery)}</p>
                ) : null}
                <Button as="link" to={`/tracking/${partnerShipping.id}`} variant="ghost">Track shipment</Button>
              </div>
            ) : (
              <p className="text-sm text-he-muted">Partner shipping status will appear here.</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
