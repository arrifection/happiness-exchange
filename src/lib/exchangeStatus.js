/** Labels and progress mapping for existing Exchange backend statuses. */

export const TRANSACTION_STATUS_LABELS = {
  ACCEPTED: 'Exchange Accepted',
  COLLECTING_SHIPPING: 'Shipping Details',
  AWAITING_PAYMENT: 'Awaiting Payment',
  PAID: 'Ready to Ship',
  SHIPPING: 'Ready to Ship',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
}

export const SHIPPING_STATUS_LABELS = {
  awaiting_details: 'Collecting shipping details',
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  ready_to_ship: 'Ready to ship',
  pickup_scheduled: 'Pickup scheduled',
  shipped: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  delivery_failed: 'Delivery failed',
  returned: 'Returned',
  cancelled: 'Cancelled',
}

export const PAYMENT_STATUS_LABELS = {
  pending: 'Payment pending',
  paid: 'Payment recorded',
  failed: 'Payment failed',
  refunded: 'Refunded',
}

const PROGRESS_STEPS = [
  {
    key: 'accepted',
    label: 'Exchange Accepted',
    currentWhen: ['ACCEPTED'],
    doneWhen: ['COLLECTING_SHIPPING', 'AWAITING_PAYMENT', 'PAID', 'SHIPPING', 'SHIPPED', 'DELIVERED', 'COMPLETED'],
  },
  {
    key: 'details',
    label: 'Shipping Details',
    currentWhen: ['COLLECTING_SHIPPING'],
    doneWhen: ['AWAITING_PAYMENT', 'PAID', 'SHIPPING', 'SHIPPED', 'DELIVERED', 'COMPLETED'],
  },
  {
    key: 'payment',
    label: 'Awaiting Payment',
    currentWhen: ['AWAITING_PAYMENT'],
    doneWhen: ['PAID', 'SHIPPING', 'SHIPPED', 'DELIVERED', 'COMPLETED'],
  },
  {
    key: 'ready',
    label: 'Ready to Ship',
    currentWhen: ['PAID', 'SHIPPING'],
    doneWhen: ['SHIPPED', 'DELIVERED', 'COMPLETED'],
  },
  {
    key: 'shipped',
    label: 'Shipped',
    currentWhen: ['SHIPPED'],
    doneWhen: ['DELIVERED', 'COMPLETED'],
  },
  {
    key: 'delivered',
    label: 'Delivered',
    currentWhen: ['DELIVERED'],
    doneWhen: ['COMPLETED'],
  },
  {
    key: 'completed',
    label: 'Completed',
    currentWhen: ['COMPLETED'],
    doneWhen: [],
  },
]

export function transactionStatusLabel(status) {
  const key = String(status || '').toUpperCase()
  return TRANSACTION_STATUS_LABELS[key] || String(status || 'Unknown').replace(/_/g, ' ')
}

export function shippingStatusLabel(status) {
  const key = String(status || '').toLowerCase()
  return SHIPPING_STATUS_LABELS[key] || String(status || 'Unknown').replace(/_/g, ' ')
}

export function paymentStatusLabel(status) {
  const key = String(status || '').toLowerCase()
  return PAYMENT_STATUS_LABELS[key] || String(status || 'Unknown').replace(/_/g, ' ')
}

export function exchangeProgressSteps(status) {
  const current = String(status || '').toUpperCase()
  if (current === 'EXPIRED' || current === 'CANCELLED') {
    return [
      { key: 'accepted', label: 'Exchange Accepted', state: 'done' },
      { key: current.toLowerCase(), label: transactionStatusLabel(current), state: 'current' },
    ]
  }

  return PROGRESS_STEPS.map((step) => {
    let state = 'upcoming'
    if (step.doneWhen.includes(current)) state = 'done'
    else if (step.currentWhen.includes(current)) state = 'current'
    return { key: step.key, label: step.label, state }
  })
}
