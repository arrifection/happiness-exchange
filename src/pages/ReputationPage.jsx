import { Link } from 'react-router-dom'

const BADGE_LEVELS = [
  {
    id: 'new_member',
    label: 'New Member',
    icon: '🌱',
    desc: 'Welcome to the community!',
    minPoints: 0,
    color: '#68766d',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  {
    id: 'kind_sharer',
    label: 'Kind Sharer',
    icon: '🤝',
    desc: "You've shared your first items.",
    minPoints: 10,
    color: '#0369a1',
    bg: '#e0f2fe',
    border: '#7dd3fc',
  },
  {
    id: 'trusted_member',
    label: 'Trusted Member',
    icon: '⭐',
    desc: 'The community trusts you.',
    minPoints: 60,
    color: '#8b4cf6',
    bg: '#efe7ff',
    border: '#c084fc',
  },
  {
    id: 'community_hero',
    label: 'Community Hero',
    icon: '🏆',
    desc: 'An outstanding contributor.',
    minPoints: 150,
    color: '#c65d4a',
    bg: '#fef2f2',
    border: '#fca5a5',
  },
  {
    id: 'top_donor_week',
    label: 'Top Donor of the Week',
    icon: '🔥',
    desc: 'Most active sharer this week.',
    minPoints: 300,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fcd34d',
  },
  {
    id: 'top_donor_month',
    label: 'Top Donor of the Month',
    icon: '👑',
    desc: 'Community legend of the month.',
    minPoints: 600,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#8b4cf6',
  },
]

function StarRating({ rating, size = 'md' }) {
  const stars = [1, 2, 3, 4, 5]
  const sz = size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'
  return (
    <div className="flex items-center gap-1">
      {stars.map((star) => (
        <svg
          key={star}
          className={sz}
          fill={star <= Math.round(rating) ? '#f59e0b' : 'none'}
          viewBox="0 0 24 24"
          stroke={star <= Math.round(rating) ? '#f59e0b' : '#d1d5db'}
          strokeWidth="1.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.499z" />
        </svg>
      ))}
    </div>
  )
}

function BadgeCard({ badge, unlocked, isCurrent }) {
  return (
    <div
      className={`relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all duration-300 ${
        unlocked
          ? 'shadow-sm hover:-translate-y-1 hover:shadow-md cursor-default'
          : 'opacity-40 grayscale'
      } ${
        isCurrent
          ? 'ring-2 ring-[#8b4cf6] ring-offset-2'
          : ''
      }`}
      style={unlocked ? { background: badge.bg, borderColor: badge.border } : { background: '#f9f9f9', borderColor: '#e5e7eb' }}
    >
      {isCurrent && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[#8b4cf6] px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white shadow">
          Current
        </div>
      )}
      <div className="text-3xl">{badge.icon}</div>
      <p className="text-[11px] font-bold" style={{ color: badge.color }}>{badge.label}</p>
      <p className="text-[9px] text-[#68766d]">{badge.desc}</p>
      <p className="text-[9px] font-bold text-[#8c755f]/60">{badge.minPoints}+ pts</p>
    </div>
  )
}

function ReviewCard({ review }) {
  const dateStr = review.created_at
    ? new Date(review.created_at).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div className="rounded-2xl border border-[#efe8da] bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold text-[#1f1f1f]">{review.reviewer_name || 'Community Member'}</p>
          <p className="text-[10px] text-[#8c755f]/70">{review.item_title || 'Exchange'}</p>
        </div>
        <span className="text-[10px] text-[#8c755f]/50">{dateStr}</span>
      </div>
      <div className="mt-2">
        <StarRating rating={review.rating || 0} />
      </div>
      {review.comment && (
        <p className="mt-2 text-[12px] leading-relaxed text-[#68766d] italic">"{review.comment}"</p>
      )}
    </div>
  )
}

export default function ReputationPage({ currentUser, myReputation, profileReviews }) {
  if (!currentUser) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-[#68766d]">Please log in to view your reputation.</p>
      </div>
    )
  }

  const completedCount = myReputation?.completed_exchange_count || 0
  const sharedCount = myReputation?.completed_shared_count || 0
  const avgRating = myReputation?.average_rating || 0
  const reviewCount = myReputation?.review_count || 0
  const trustPoints = sharedCount * 10 + completedCount * 50
  const currentBadge = myReputation?.current_badge || 'New Member'

  // Progress to next badge
  const currentLevel = BADGE_LEVELS.findIndex(
    (b) => b.label.toLowerCase() === currentBadge.toLowerCase()
  )
  const currentLevelData = BADGE_LEVELS[Math.max(currentLevel, 0)]
  const nextLevelData = BADGE_LEVELS[Math.min(currentLevel + 1, BADGE_LEVELS.length - 1)]
  const progressPct =
    currentLevelData && nextLevelData && currentLevelData.minPoints < nextLevelData.minPoints
      ? Math.min(
          100,
          ((trustPoints - currentLevelData.minPoints) /
            (nextLevelData.minPoints - currentLevelData.minPoints)) *
            100
        )
      : 100

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      {/* Back */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#8c755f] hover:text-[#8b4cf6] transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </Link>

      {/* Trust Score Hero */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#8b4cf6] via-[#7b40e6] to-[#4f2ab8] p-8 text-white shadow-xl">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-white/5" />

        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">
            Community Reputation
          </p>
          <h1 className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-bold md:text-4xl">
            {currentUser.name.split(' ')[0]}'s Trust Score
          </h1>

          <div className="mt-6 flex items-end gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Trust Points</p>
              <p className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-5xl font-bold text-[#ffcc22] drop-shadow-[0_0_20px_rgba(255,204,34,0.5)]">
                {trustPoints}
              </p>
            </div>
            <div className="mb-2">
              <div className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 backdrop-blur-sm">
                <span className="text-2xl">{currentLevelData?.icon}</span>
                <span className="text-[12px] font-bold">{currentBadge}</span>
              </div>
            </div>
          </div>

          {/* Progress to next badge */}
          {currentLevel < BADGE_LEVELS.length - 1 && (
            <div className="mt-5">
              <div className="flex justify-between text-[10px] font-bold text-white/70">
                <span>{currentBadge}</span>
                <span>{nextLevelData?.label}</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-[#ffcc22] transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-1 text-right text-[9px] text-white/50">
                {trustPoints} / {nextLevelData?.minPoints} pts to next badge
              </p>
            </div>
          )}

          {currentLevel === BADGE_LEVELS.length - 1 && (
            <p className="mt-4 text-[11px] font-bold text-[#ffcc22]">🏆 You've reached the highest badge!</p>
          )}
        </div>
      </section>

      {/* Stats Row */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Items Shared', value: sharedCount, icon: '🎁' },
          { label: 'Completed', value: completedCount, icon: '✅' },
          { label: 'Avg Rating', value: avgRating > 0 ? avgRating.toFixed(1) : '—', icon: '⭐' },
          { label: 'Reviews', value: reviewCount, icon: '💬' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center rounded-2xl border border-[#efe8da] bg-white p-5 text-center shadow-xs"
          >
            <div className="text-2xl">{stat.icon}</div>
            <p className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold text-[#1f1f1f]">
              {stat.value}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#8c755f]/70">{stat.label}</p>
          </div>
        ))}
      </section>

      {/* Average Rating Visual */}
      {reviewCount > 0 && (
        <section className="rounded-2xl border border-[#efe8da] bg-white p-6 shadow-xs">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Community Rating</h2>
          <div className="mt-3 flex items-center gap-4">
            <p className="font-['Plus_Jakarta_Sans',sans-serif] text-4xl font-bold text-[#1f1f1f]">
              {avgRating.toFixed(1)}
            </p>
            <div>
              <StarRating rating={avgRating} size="lg" />
              <p className="mt-1 text-[11px] text-[#68766d]">Based on {reviewCount} review{reviewCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </section>
      )}

      {/* Badge Progression */}
      <section>
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Badge Progression</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {BADGE_LEVELS.map((badge) => {
            const unlocked = trustPoints >= badge.minPoints
            const isCurrent = badge.label.toLowerCase() === currentBadge.toLowerCase()
            return (
              <BadgeCard
                key={badge.id}
                badge={badge}
                unlocked={unlocked}
                isCurrent={isCurrent}
              />
            )
          })}
        </div>
      </section>

      {/* Reviews Received */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">
            Reviews Received
          </h2>
          {profileReviews?.length > 0 && (
            <span className="rounded-full bg-[#efe7ff] px-2.5 py-0.5 text-[10px] font-bold text-[#8b4cf6]">
              {profileReviews.length}
            </span>
          )}
        </div>

        {!profileReviews || profileReviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#efe8da] bg-[#faf7f1] p-8 text-center">
            <p className="text-2xl">💬</p>
            <p className="mt-2 text-[13px] font-bold text-[#1f1f1f]">No reviews yet</p>
            <p className="mt-1 text-[11px] text-[#68766d]">
              Complete exchanges to start receiving reviews from the community.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {profileReviews.map((review, i) => (
              <ReviewCard key={review.id || i} review={review} />
            ))}
          </div>
        )}
      </section>

      {/* Community Milestones */}
      <section className="rounded-2xl border border-[#efe8da] bg-gradient-to-br from-[#fffdf7] to-[#fff9e6] p-6">
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Community Milestones</h2>
        <div className="space-y-3">
          {[
            { label: 'First item shared', done: sharedCount >= 1, icon: '🎁' },
            { label: 'First exchange completed', done: completedCount >= 1, icon: '🤝' },
            { label: 'Reached Kind Sharer', done: trustPoints >= 10, icon: '💚' },
            { label: 'Reached Trusted Member', done: trustPoints >= 60, icon: '⭐' },
            { label: '5 items shared', done: sharedCount >= 5, icon: '📦' },
            { label: '10 completed exchanges', done: completedCount >= 10, icon: '🏅' },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-3">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm transition-all ${
                  m.done
                    ? 'bg-[#8b4cf6]/15 shadow-[0_0_8px_rgba(139,76,246,0.3)]'
                    : 'bg-[#f0f0f0]'
                }`}
              >
                {m.done ? m.icon : '○'}
              </div>
              <p
                className={`text-[12px] font-medium ${
                  m.done ? 'text-[#1f1f1f]' : 'text-[#8c755f]/50 line-through'
                }`}
              >
                {m.label}
              </p>
              {m.done && (
                <svg className="ml-auto h-4 w-4 text-[#8b4cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
