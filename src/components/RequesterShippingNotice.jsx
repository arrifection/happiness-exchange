import { useEffect } from 'react'

import { Button } from './ui.jsx'

export const REQUESTER_SHIPPING_NOTICE_KIND = {
  giveaway: 'giveaway',
  exchange: 'exchange',
}

function productLabel(kind) {
  return kind === REQUESTER_SHIPPING_NOTICE_KIND.exchange ? 'Exchange' : 'Give Away'
}

export default function RequesterShippingNotice({
  open,
  kind = REQUESTER_SHIPPING_NOTICE_KIND.giveaway,
  confirming = false,
  onCancel,
  onConfirm,
}) {
  const product = productLabel(kind)

  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !confirming) {
        onCancel?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, confirming, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-he-border bg-he-surface p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="requester-shipping-notice-title"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-he-purple">
          Before you continue
        </p>
        <h2
          id="requester-shipping-notice-title"
          className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold text-he-ink"
        >
          Thanks for your interest! 💛
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-he-ink">
          We really want this {product} to happen smoothly.
        </p>
        <p className="mt-3 text-sm font-semibold text-he-ink">
          A small note before you continue:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-he-ink">
          <li>
            Delivery/courier charges must be paid by the receiver/requester to our team
            in advance, before we arrange the shipment.
          </li>
          <li>
            This helps us arrange the courier while keeping both users&apos; personal
            addresses and phone numbers private.
          </li>
          <li>
            Once the delivery details are confirmed, our team will coordinate with the
            courier and handle the shipping process.
          </li>
          <li>
            Charges may vary depending on distance. Deliveries within the same city or
            nearby areas are generally lower, while inter-city deliveries may cost more.
          </li>
          <li>
            We will let you know the applicable delivery charges before proceeding.
          </li>
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-he-muted">
          Your personal address and phone number will not be shared publicly.
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={confirming}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button type="button" className="flex-1" disabled={confirming} onClick={onConfirm}>
            {confirming ? 'Sending…' : 'I Understand & Continue'}
          </Button>
        </div>
      </div>
    </div>
  )
}
