export const SHIPMENT_STATUS_LABELS = {
  PENDING: 'Pending',
  PAYMENT_REQUIRED: 'Payment Required',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  READY_TO_SHIP: 'Ready to Ship',
  PICKUP_SCHEDULED: 'Pickup Scheduled',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  DELIVERY_FAILED: 'Delivery Failed',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
}

export function shipmentStatusLabel(status) {
  const key = String(status || '').toUpperCase()
  if (SHIPMENT_STATUS_LABELS[key]) return SHIPMENT_STATUS_LABELS[key]
  return String(status || 'Unknown').replace(/_/g, ' ')
}

export function formatEstimatedDelivery(value) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
