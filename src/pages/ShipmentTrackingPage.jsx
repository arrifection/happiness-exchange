import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { Button, StatusBadge } from '../components/ui.jsx'
import { apiUrl } from '../lib/api.js'
import { formatEstimatedDelivery, shipmentStatusLabel } from '../lib/shippingStatus.js'

function Timeline({ steps }) {
  const items = Array.isArray(steps) ? steps : []
  return (
    <ol className="space-y-0">
      {items.map((step, index) => {
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
                {isDone ? '✓' : isCurrent ? '●' : '○'}
              </div>
              {index < items.length - 1 ? (
                <div className={`w-0.5 flex-1 min-h-4 ${isDone ? 'bg-he-purple' : 'bg-he-border'}`} />
              ) : null}
            </div>
            <p className={`pb-4 pt-0.5 text-sm ${isDone || isCurrent ? 'font-bold text-he-ink' : 'text-he-muted'}`}>
              {step.label}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

function ShipmentCard({ title, shipment, emphasize }) {
  if (!shipment) return null
  const trackingHref = shipment.tracking_page_url || `/tracking/${shipment.id}`
  return (
    <div className={`rounded-2xl border bg-he-surface p-4 space-y-2 ${emphasize ? 'border-he-purple/40' : 'border-he-border'}`}>
      <h2 className="text-sm font-bold text-he-ink">{title}</h2>
      {shipment.item_title ? <p className="text-sm text-he-ink">Item: {shipment.item_title}</p> : null}
      <p className="text-sm text-he-muted">Carrier: {shipment.carrier || 'Not assigned yet'}</p>
      <p className="text-sm text-he-muted">
        Tracking:{' '}
        {shipment.tracking_number ? (
          <Link className="font-bold text-he-purple hover:underline" to={trackingHref}>
            {shipment.tracking_number}
          </Link>
        ) : (
          'Not assigned yet'
        )}
      </p>
      <p className="text-sm text-he-ink">Status: {shipment.status_label || shipmentStatusLabel(shipment.status)}</p>
      <p className="text-sm text-he-muted">Estimated delivery: {formatEstimatedDelivery(shipment.estimated_delivery)}</p>
    </div>
  )
}

export default function ShipmentTrackingPage({ currentUser, token }) {
  const { shipmentId } = useParams()
  const [shipment, setShipment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(apiUrl(`/api/shipments/${shipmentId}`), {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Could not load shipment.')
        setShipment(data)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }
    if (token && shipmentId) load()
  }, [shipmentId, token])

  if (!currentUser) return <Navigate to="/login" replace />

  const related = shipment?.related_shipments || []
  const mine = shipment
  const other = related[0]

  return (
    <div className="app-shell mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-he-purple">Track Shipment</p>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold text-he-ink">
            Shipment #{String(shipmentId || '').slice(-8)}
          </h1>
        </div>
        <Button as="link" to="/deliveries" variant="ghost">
          Back
        </Button>
      </div>

      {loading ? <p className="text-sm text-he-muted">Loading…</p> : null}
      {error ? <p className="text-sm font-bold text-he-danger">{error}</p> : null}

      {shipment ? (
        <>
          <div className="rounded-2xl border border-he-border bg-he-surface p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={String(shipment.status || shipment.shipping_status || '').toLowerCase()} />
              <span className="text-sm font-bold text-he-ink">{shipment.status_label || shipmentStatusLabel(shipment.status)}</span>
            </div>
            <p className="text-sm text-he-ink">Carrier: {shipment.carrier || 'Not assigned yet'}</p>
            <p className="text-sm text-he-ink">Tracking Number: {shipment.tracking_number || 'Not assigned yet'}</p>
            <p className="text-sm text-he-ink">Estimated Delivery: {formatEstimatedDelivery(shipment.estimated_delivery)}</p>
            {shipment.tracking_url ? (
              <a className="text-xs font-bold text-he-purple hover:underline" href={shipment.tracking_url} target="_blank" rel="noreferrer">
                Open carrier tracking
              </a>
            ) : null}
          </div>

          <div className="rounded-2xl border border-he-border bg-he-surface p-4">
            <h2 className="mb-3 text-sm font-bold text-he-ink">Progress</h2>
            <Timeline steps={shipment.timeline} />
          </div>

          {shipment.transaction_type === 'EXCHANGE' || related.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              <ShipmentCard title="Your Shipment" shipment={mine} emphasize />
              <ShipmentCard title="Other User's Shipment" shipment={other} />
            </div>
          ) : null}

          <p className="text-xs text-he-muted">
            Private addresses and phone numbers stay with admin. Only tracking details appear here.
          </p>
        </>
      ) : null}
    </div>
  )
}
