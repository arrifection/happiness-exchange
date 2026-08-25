export const EXCHANGE_TRANSACTION_STATUSES = [
  'ACCEPTED',
  'COLLECTING_SHIPPING',
  'AWAITING_PAYMENT',
  'PAID',
  'SHIPPING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
]

export const EXCHANGE_SHIPPING_STATUSES = [
  'awaiting_details',
  'awaiting_payment',
  'paid',
  'ready_to_ship',
  'pickup_scheduled',
  'shipped',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'delivery_failed',
  'returned',
  'cancelled',
]

export const EXCHANGE_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded']

const TRANSACTION_LABELS = {
  ACCEPTED: 'Accepted',
  COLLECTING_SHIPPING: 'Awaiting Shipping Details',
  AWAITING_PAYMENT: 'Awaiting Payment',
  PAID: 'Paid',
  SHIPPING: 'Ready to Ship',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
}

const SHIPPING_LABELS = {
  awaiting_details: 'Pending',
  awaiting_payment: 'Payment Required',
  paid: 'Payment Confirmed',
  ready_to_ship: 'Ready to Ship',
  pickup_scheduled: 'Pickup Scheduled',
  shipped: 'Picked Up',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  delivery_failed: 'Delivery Failed',
  returned: 'Returned',
  cancelled: 'Cancelled',
}

const PAYMENT_LABELS = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
}

export function formatExchangeStatus(status) {
  if (!status) return '—'
  return TRANSACTION_LABELS[status] || String(status).replace(/_/g, ' ')
}

export function formatShippingStatus(status) {
  if (!status) return '—'
  return SHIPPING_LABELS[status] || String(status).replace(/_/g, ' ')
}

export function formatPaymentStatus(status) {
  if (!status) return '—'
  return PAYMENT_LABELS[status] || String(status)
}

export function exchangeStatusBadgeClass(status) {
  switch (status) {
    case 'COMPLETED':
    case 'DELIVERED':
    case 'SHIPPED':
    case 'PAID':
      return 'badge-green'
    case 'CANCELLED':
    case 'EXPIRED':
      return 'badge-red'
    case 'AWAITING_PAYMENT':
    case 'COLLECTING_SHIPPING':
    case 'ACCEPTED':
      return 'badge-yellow'
    default:
      return 'badge-blue'
  }
}

export function shippingStatusBadgeClass(status) {
  switch (status) {
    case 'delivered':
    case 'shipped':
    case 'paid':
      return 'badge-green'
    case 'awaiting_details':
    case 'awaiting_payment':
      return 'badge-yellow'
    default:
      return 'badge-blue'
  }
}

export function formatExchangeDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function shortId(value) {
  const id = String(value || '')
  if (id.length <= 8) return id || '—'
  return id.slice(-8)
}

export function shippingPaymentSummary(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return { shipping: 'No shipping yet', payment: '—' }
  }
  const shipping = [...new Set(records.map((record) => formatShippingStatus(record.shipping_status)))]
  const payment = [...new Set(records.map((record) => formatPaymentStatus(record.payment_status)))]
  return {
    shipping: shipping.join(' / '),
    payment: payment.join(' / '),
  }
}

export function isTerminalExchangeStatus(status) {
  return status === 'COMPLETED' || status === 'EXPIRED' || status === 'CANCELLED'
}
