import { useEffect, useState } from 'react'

import { Button, EmptyState, StatusBadge, Surface } from '../components/ui.jsx'
import { apiUrl, asArray } from '../lib/api.js'
import { IS_LOCAL_DEV } from '../lib/localDevAuth.js'
import { formatEstimatedDelivery, shipmentStatusLabel } from '../lib/shippingStatus.js'

export default function MyDeliveriesPage({ currentUser, token }) {
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      if (!token) return
      setLoading(true)
      setError('')
      try {
        const res = await fetch(apiUrl('/api/shipments/my'), {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Could not load deliveries.')
        setShipments(asArray(data.shipments))
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  return (
    <div className="app-shell mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-he-purple">Delivery</p>
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold text-he-ink">My deliveries</h1>
        <p className="mt-1 text-sm text-he-muted">
          Track Give Away and Exchange shipments. Partner addresses stay private.
        </p>
      </div>

      {loading ? <p className="text-sm text-he-muted">Loading…</p> : null}
      {error ? <p className="text-sm font-bold text-he-danger">{error}</p> : null}

      {!loading && shipments.length === 0 ? (
        <EmptyState
          icon="items"
          title="No deliveries yet"
          description={
            IS_LOCAL_DEV
              ? 'Local fake deliveries appear after python scripts/seed_local_shipments.py. Then refresh this page.'
              : 'Deliveries appear after an Exchange is accepted or a Give Away request is approved.'
          }
        />
      ) : null}

      {shipments.map((shipment) => (
        <Surface key={shipment.id} className="space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-he-soft">
                {shipment.transaction_type === 'GIVEAWAY' ? 'Give Away' : 'Exchange'}
              </p>
              <h2 className="text-sm font-bold text-he-ink">{shipment.item_title || 'Shipment'}</h2>
            </div>
            <StatusBadge status={String(shipment.status || shipment.shipping_status || '').toLowerCase()} />
          </div>
          <p className="text-sm text-he-muted">
            {shipment.status_label || shipmentStatusLabel(shipment.status)} · {shipment.carrier || 'No carrier yet'}
          </p>
          <p className="text-sm text-he-muted">
            Tracking: {shipment.tracking_number || 'Not assigned yet'}
          </p>
          <p className="text-sm text-he-muted">
            Estimated delivery: {formatEstimatedDelivery(shipment.estimated_delivery)}
          </p>
          <Button as="link" to={`/tracking/${shipment.id}`}>
            Track this delivery
          </Button>
        </Surface>
      ))}
    </div>
  )
}
