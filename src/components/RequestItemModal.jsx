import { useEffect, useState } from 'react'

import { Link } from 'react-router-dom'

import { Button } from './ui.jsx'

const MIN_REASON_LENGTH = 30
const MAX_REASON_LENGTH = 500

const EXAMPLE_REASONS = [
  'I am a university student and need these books for my semester.',
  'I recently moved and currently do not have basic kitchen items.',
]

export default function RequestItemModal({ item, open, submitting, error, missingWhatsApp = false, onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  const trimmedLength = reason.trim().length
  const isTooShort = trimmedLength > 0 && trimmedLength < MIN_REASON_LENGTH
  const isValid = trimmedLength >= MIN_REASON_LENGTH && trimmedLength <= MAX_REASON_LENGTH

  useEffect(() => {
    if (open) {
      setReason('')
    }
  }, [open, item?.id])

  if (!open || !item) {
    return null
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!isValid || submitting) return
    onSubmit?.(item.id, reason.trim())
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <div
        className="w-full max-w-lg rounded-2xl border border-he-border bg-he-surface p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-item-title"
      >
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-he-purple">Request Item</p>
          <h2 id="request-item-title" className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold text-he-ink">
            {item.title}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {missingWhatsApp ? (
            <div className="rounded-xl border border-he-danger/30 bg-he-danger/5 p-3 text-sm text-he-ink">
              <p className="font-semibold">WhatsApp number required</p>
              <p className="mt-1 text-he-muted">
                Please add your WhatsApp number in Settings before listing or requesting.{' '}
                <Link to="/profile" className="font-bold text-he-purple hover:underline">Go to Settings</Link>
              </p>
            </div>
          ) : null}
          <div>
            <label htmlFor="request-reason" className="mb-1.5 block text-sm font-semibold text-he-ink">
              Why do you need this item?
            </label>
            <p className="mb-2 text-xs leading-relaxed text-he-muted">
              Briefly explain how this item would help you. Your message will be shown to the donor when they review your request.
            </p>
            <textarea
              id="request-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, MAX_REASON_LENGTH))}
              rows={5}
              required
              placeholder="Explain your situation and how this item would help you."
              className="w-full rounded-xl border border-he-border bg-he-surface-soft px-3 py-2.5 text-sm text-he-ink outline-none transition focus:border-he-purple focus:ring-2 focus:ring-he-purple/20"
            />
            <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px]">
              <span className={isTooShort ? 'font-semibold text-he-danger' : 'text-he-muted'}>
                {isTooShort
                  ? `Please write at least ${MIN_REASON_LENGTH} characters (${MIN_REASON_LENGTH - trimmedLength} more needed).`
                  : 'Minimum 30 characters required.'}
              </span>
              <span className="font-semibold text-he-muted">
                {trimmedLength}/{MAX_REASON_LENGTH}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-he-border/70 bg-he-surface-soft p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-he-soft">Examples</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-he-muted">
              {EXAMPLE_REASONS.map((example) => (
                <li key={example} className="italic">&ldquo;{example}&rdquo;</li>
              ))}
            </ul>
          </div>

          {error ? (
            <p className="text-xs font-semibold text-he-danger">{error}</p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" disabled={submitting} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={!isValid || submitting || missingWhatsApp}>
              {submitting ? 'Sending…' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
