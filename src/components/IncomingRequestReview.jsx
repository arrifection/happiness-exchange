import TrustBadge from './TrustBadge.jsx'
import { RatingStars } from './reputation.jsx'
import { displayTransactionCity } from '../lib/locations.js'

function formatRequestDate(value) {
  if (!value) return 'Recently'
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return 'Recently'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate)
}

export default function IncomingRequestReview({ request }) {
  const reputation = request.requester_reputation

  return (
    <div className="mt-2 space-y-2 border-t border-he-border/60 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-he-muted">
          Requester: {request.requester_name}
        </p>
        <span className="text-[10px] text-he-soft">·</span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-he-muted">
          {displayTransactionCity(request.requester_city)}
        </p>
        <span className="text-[10px] text-he-soft">·</span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-he-muted">
          {formatRequestDate(request.created_at)}
        </p>
      </div>
      {request.item_title ? (
        <p className="text-[12px] text-he-ink">
          Requesting: <span className="font-bold">{request.item_title}</span>
        </p>
      ) : null}

      {reputation ? (
        <div className="flex flex-wrap items-center gap-2">
          <TrustBadge
            level={reputation.level}
            trustScore={reputation.trust_score}
            nextLevelPoints={reputation.next_level_points}
            size="sm"
          />
          {reputation.review_count > 0 ? (
            <div className="flex items-center gap-1 text-[10px] text-he-muted">
              <RatingStars rating={reputation.average_rating} reviewCount={reputation.review_count} compact />
            </div>
          ) : (
            <span className="text-[10px] font-semibold text-he-soft">No reviews yet</span>
          )}
        </div>
      ) : null}

      {request.reason ? (
        <blockquote className="rounded-xl border border-he-purple/20 bg-he-purple/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-he-purple">Why they need it</p>
          <p className="mt-1.5 text-sm leading-relaxed text-he-ink">&ldquo;{request.reason}&rdquo;</p>
        </blockquote>
      ) : null}
    </div>
  )
}
