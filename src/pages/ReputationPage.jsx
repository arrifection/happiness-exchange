import { Link } from 'react-router-dom'

import { ReviewEmptyState, StarRatingDisplay } from '../components/reputation.jsx'
import TrustBadge from '../components/TrustBadge.jsx'
import TrustLevelLadder from '../components/TrustLevelLadder.jsx'
import { Surface } from '../components/ui.jsx'
import { getLevelProgress, getTrustLevelMeta, normalizeTrustLevel } from '../lib/trustLevels.js'

function ReviewCard({ review }) {
  const dateStr = review.created_at
    ? new Date(review.created_at).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <Surface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-bold text-he-ink">{review.reviewer_name || 'Community Member'}</p>
          <p className="text-[10px] text-he-muted">{review.item_title || 'Exchange'}</p>
        </div>
        <span className="shrink-0 text-[10px] text-he-soft">{dateStr}</span>
      </div>
      <div className="mt-2">
        <StarRatingDisplay rating={review.rating || 0} size="lg" />
      </div>
      {review.comment ? (
        <p className="mt-2 text-[12px] leading-relaxed text-he-muted italic">&ldquo;{review.comment}&rdquo;</p>
      ) : null}
    </Surface>
  )
}

export default function ReputationPage({ currentUser, myReputation, profileReviews }) {
  if (!currentUser) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-sm text-he-muted">Please log in to view your reputation.</p>
      </div>
    )
  }

  const completedCount = myReputation?.completed_exchange_count || 0
  const sharedCount = myReputation?.completed_shared_count || 0
  const avgRating = myReputation?.average_rating || 0
  const reviewCount = myReputation?.review_count || 0
  const trustScore = myReputation?.trust_score || 0
  const currentLevel = normalizeTrustLevel(myReputation?.level)
  const nextLevelPts = myReputation?.next_level_points
  const badges = myReputation?.badges || []
  const trustEvents = myReputation?.trust_events || []
  const levelMeta = getTrustLevelMeta(currentLevel)
  const progress = getLevelProgress(trustScore, currentLevel)
  const displayName = currentUser?.name?.split(' ')[0] || 'Your'

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 pb-10">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-he-soft transition-colors hover:text-he-purple"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </Link>

      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-he-purple via-[#7b40e6] to-[#4f2ab8] p-6 text-white shadow-xl md:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-white/5" />

        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">
            Community Reputation
          </p>
          <h1 className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold md:text-4xl">
            {displayName}&apos;s Trust Score
          </h1>

          <div className="mt-6 flex flex-wrap items-end gap-4 md:gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Trust Points</p>
              <p className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-4xl font-bold text-he-yellow drop-shadow-[0_0_20px_rgba(255,204,34,0.35)] md:text-5xl">
                {trustScore}
              </p>
              <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-white/70">{levelMeta.description}</p>
            </div>
            <TrustBadge
              level={currentLevel}
              trustScore={trustScore}
              nextLevelPoints={nextLevelPts}
              showPoints={false}
              className="mb-1"
            />
          </div>

          {nextLevelPts ? (
            <div className="mt-5 max-w-xl">
              <div className="flex justify-between gap-2 text-[10px] font-bold text-white/70">
                <span>{currentLevel}</span>
                <span>{progress.pointsToNext} pts to {progress.nextLevel}</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-he-yellow transition-all duration-700"
                  style={{ width: `${progress.progressPct}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[11px] font-bold text-he-yellow">You&apos;ve reached the highest level!</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-he-soft">Trust Progression</h2>
        <TrustLevelLadder level={currentLevel} trustScore={trustScore} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Items Shared', value: sharedCount, icon: '🎁' },
          { label: 'Completed', value: completedCount, icon: '✅' },
          { label: 'Avg Rating', value: reviewCount > 0 ? avgRating.toFixed(1) : '—', icon: '⭐' },
          { label: 'Reviews', value: reviewCount, icon: '💬' },
        ].map((stat) => (
          <Surface key={stat.label} className="flex flex-col items-center p-4 text-center">
            <div className="text-2xl">{stat.icon}</div>
            <p className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold text-he-ink">
              {stat.value}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-he-soft">{stat.label}</p>
          </Surface>
        ))}
      </section>

      {reviewCount > 0 ? (
        <Surface className="p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-he-soft">Community Rating</h2>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <p className="font-['Plus_Jakarta_Sans',sans-serif] text-4xl font-bold text-he-ink">
              {avgRating.toFixed(1)}
            </p>
            <div>
              <StarRatingDisplay rating={avgRating} size="lg" />
              <p className="mt-1 text-[11px] text-he-muted">
                Based on {reviewCount} review{reviewCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </Surface>
      ) : null}

      <section>
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-he-soft">Trust History</h2>
        {trustEvents.length === 0 ? (
          <ReviewEmptyState
            title="No trust events yet"
            description="Donate items, complete exchanges, and earn positive reviews to grow your score."
          />
        ) : (
          <Surface className="overflow-hidden p-0">
            <ul className="divide-y divide-he-border">
              {trustEvents.map((evt, idx) => (
                <li key={idx} className="flex items-center justify-between gap-3 p-4 hover:bg-he-surface-soft">
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold capitalize text-he-ink">{evt.event_type.replace('_', ' ')}</p>
                    <p className="text-[10px] text-he-muted">{evt.description}</p>
                    <p className="mt-1 text-[9px] text-he-soft">{new Date(evt.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className={`shrink-0 font-bold ${evt.points_change > 0 ? 'text-he-purple' : 'text-he-danger'}`}>
                    {evt.points_change > 0 ? '+' : ''}{evt.points_change}
                  </div>
                </li>
              ))}
            </ul>
          </Surface>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-he-soft">Badges Earned</h2>
        <div className="flex flex-wrap gap-2">
          {badges.length === 0 ? (
            <p className="text-[11px] italic text-he-muted">No donation badges yet — complete your first exchange.</p>
          ) : (
            badges.map((badge) => (
              <div key={badge} className="flex items-center gap-2 rounded-full border border-he-border bg-he-surface-soft px-4 py-1.5 text-[11px] font-bold text-he-ink">
                <span>🏅</span> {badge}
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-he-soft">Reviews Received</h2>
          {profileReviews?.length > 0 ? (
            <span className="rounded-full bg-he-purple/15 px-2.5 py-0.5 text-[10px] font-bold text-he-purple">
              {profileReviews.length}
            </span>
          ) : null}
        </div>

        {!profileReviews || profileReviews.length === 0 ? (
          <ReviewEmptyState />
        ) : (
          <div className="grid gap-3">
            {profileReviews.map((review, i) => (
              <ReviewCard key={review.id || i} review={review} />
            ))}
          </div>
        )}
      </section>

      {progress.nextLevel ? (
        <p className="text-center text-[11px] text-he-muted">
          {progress.pointsToNext} points until <strong className="text-he-ink">{progress.nextLevel}</strong>
        </p>
      ) : null}
    </div>
  )
}
