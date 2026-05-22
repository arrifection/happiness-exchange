import { useEffect, useState } from 'react'

import { Button, Surface } from './ui.jsx'

const BADGE_STYLES = {
  'New Member': 'border-[#efe8da] bg-[#fffdfb] text-[#8c755f]',
  'Kind Sharer': 'border-[#ffcc22]/30 bg-[#fff8de] text-[#9a7420]',
  'Trusted Member': 'border-[#8b4cf6]/20 bg-[#f5efff] text-[#7340d2]',
  'Community Hero': 'border-[#8b4cf6]/20 bg-gradient-to-r from-[#8b4cf6] to-[#7340d2] text-white',
}

function StarIcon({ filled }) {
  return (
    <svg
      className={`h-4 w-4 ${filled ? 'text-[#ffcc22]' : 'text-[#e9dcc9]'}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.539 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.95-.69l1.07-3.292Z" />
    </svg>
  )
}

export function ReputationBadge({ label, compact = false }) {
  if (!label) {
    return null
  }

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border font-bold uppercase tracking-widest',
        compact ? 'px-2 py-1 text-[8px]' : 'px-3 py-1.5 text-[9px]',
        BADGE_STYLES[label] || BADGE_STYLES['New Member'],
      ].join(' ')}
    >
      {label}
    </span>
  )
}

export function PlaceholderBadge({ label }) {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-[#efe8da] bg-[#faf7f1] px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/70">
      {label}
    </span>
  )
}

export function RatingStars({ rating = 0, reviewCount = 0, showValue = true }) {
  const filledStars = Math.round(rating)

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon key={star} filled={star <= filledStars} />
        ))}
      </div>
      {showValue ? (
        <span className="text-[10px] font-bold uppercase tracking-wide text-[#8c755f]">
          {reviewCount > 0 ? `${rating.toFixed(1)} | ${reviewCount} review${reviewCount === 1 ? '' : 's'}` : 'No reviews yet'}
        </span>
      ) : null}
    </div>
  )
}

function StarButton({ value, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className="rounded-full p-1 transition hover:bg-[#fff8de] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4cf6]/20"
      aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
    >
      <svg
        className={`h-8 w-8 ${active ? 'text-[#ffcc22]' : 'text-[#eadfce]'}`}
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.539 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.95-.69l1.07-3.292Z" />
      </svg>
    </button>
  )
}

export function ReviewModal({ open, context, submitting, onClose, onSubmit }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }

    setRating(5)
    setComment('')
    setError('')
  }, [open, context?.itemId])

  if (!open || !context) {
    return null
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const cleanedComment = comment.trim()
    if (cleanedComment.length < 2) {
      setError('Please add a short comment.')
      return
    }

    setError('')
    const result = await onSubmit({
      rating,
      comment: cleanedComment,
    })

    if (result?.error) {
      setError(result.error)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#1f1f1f]/35 p-3 md:items-center md:p-5">
      <Surface className="w-full max-w-md p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b4cf6]">Leave Review</p>
            <h2 className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#1f1f1f]">
              {context.reviewedUserName}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-[#68766d]">
              Share a quick review for <strong>{context.itemTitle}</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#8c755f] transition hover:bg-[#faf7f1] hover:text-[#1f1f1f]"
            aria-label="Close review form"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/80">Rating</p>
            <div className="mt-2 flex items-center justify-between rounded-card border border-[#efe8da] bg-[#fffdfb] px-3 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <StarButton
                  key={star}
                  value={star}
                  active={star <= rating}
                  onSelect={setRating}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/80" htmlFor="review-comment">
              Comment
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              maxLength={400}
              placeholder="Write a short, kind review..."
              className="mt-2 w-full rounded-input border border-[#efe8da] bg-[#fffdfb] px-3 py-2.5 text-sm text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10"
            />
            <p className="mt-1 text-[10px] text-[#8c755f]/70">{comment.length}/400</p>
          </div>

          {error ? <p className="text-[10px] font-bold text-[#c65d4a]">{error}</p> : null}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </div>
        </form>
      </Surface>
    </div>
  )
}
