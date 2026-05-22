import { useEffect, useState } from 'react'

import ItemCard from '../components/ItemCard.jsx'
import { PlaceholderBadge, RatingStars, ReputationBadge } from '../components/reputation.jsx'
import { Button, EmptyState, SectionHeading, Surface } from '../components/ui.jsx'

const TAGLINES = [
  'Give what you can. Find what you need.',
  'Share with kindness. Receive with dignity.',
  'Your extra can become someone else\'s blessing.',
  'A simple way to help your community.',
]

const STEPS = [
  {
    number: '1',
    title: 'List',
    description: 'Share an item you no longer need.',
  },
  {
    number: '2',
    title: 'Browse',
    description: 'Explore items posted by the community.',
  },
  {
    number: '3',
    title: 'Request',
    description: 'Send a request and coordinate pickup.',
  },
]

function HowItWorksStep({ number, title, description, isActive }) {
  return (
    <div
      className={[
        'flex flex-col gap-1 rounded-card border p-3.5 md:p-5 transition-all duration-700 ease-in-out',
        isActive
          ? 'z-10 scale-[1.02] border-[#8b4cf6]/40 bg-white shadow-[0_0_16px_rgba(139,76,246,0.12),0_0_12px_rgba(255,204,34,0.08)] md:scale-105'
          : 'z-0 scale-100 border-[#efe8da]/60 bg-[#faf7f1] shadow-none',
      ].join(' ')}
    >
      <div
        className={[
          'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors duration-700 md:h-6 md:w-6 md:text-[13px]',
          isActive ? 'bg-[#8b4cf6] text-white shadow-sm' : 'bg-[#8b4cf6]/10 text-[#8b4cf6]',
        ].join(' ')}
      >
        {number}
      </div>
      <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[12px] font-bold text-[#1f1f1f] md:text-[15px]">
        {title}
      </h3>
      <p className="text-[10px] leading-relaxed text-[#68766d] md:text-[12px]">{description}</p>
    </div>
  )
}

export default function AuthenticatedHomePage({
  items,
  currentUser,
  myReputation,
  getMyRequestForItem,
  getReviewContextForItem,
  onCreateRequest,
  onOpenReview,
  loadingItems,
  itemsError,
  myRequests,
  ownerRequests,
}) {
  const [taglineIndex, setTaglineIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const taglineInterval = window.setInterval(() => {
      setTaglineIndex((index) => (index + 1) % TAGLINES.length)
    }, 5500)

    const stepsInterval = window.setInterval(() => {
      setStepIndex((index) => (index + 1) % STEPS.length)
    }, 2500)

    return () => {
      window.clearInterval(taglineInterval)
      window.clearInterval(stepsInterval)
    }
  }, [])

  const recentItems = items.slice(0, 4)
  const displayName = currentUser?.name?.split(' ')[0] || 'Friend'

  return (
    <div className="space-y-4 md:space-y-6">
      <Surface className="overflow-hidden p-0">
        <div className="bg-gradient-to-br from-[#8b4cf6]/5 via-[#ffcc22]/2 to-transparent p-5 md:flex md:flex-col md:items-center md:px-8 md:py-12 md:text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8c755f] md:text-xs">
            Welcome back, {displayName}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 md:justify-center">
            <ReputationBadge label={myReputation?.current_badge} />
            <PlaceholderBadge label="Top Donor of the Week" />
            <PlaceholderBadge label="Top Donor of the Month" />
          </div>

          <div className="relative mt-4 flex h-16 w-full max-w-2xl items-center justify-center md:h-20">
            {TAGLINES.map((tagline, index) => (
              <h1
                key={tagline}
                className={[
                  "absolute flex w-full items-center justify-center font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold leading-snug tracking-tight text-[#1f1f1f] transition-all duration-[1200ms] ease-[cubic-bezier(0.25,1,0.5,1)] md:text-3xl lg:text-[32px]",
                  index === taglineIndex
                    ? 'translate-y-0 scale-100 opacity-100'
                    : 'translate-y-3 scale-[0.98] opacity-0',
                ].join(' ')}
              >
                {tagline}
              </h1>
            ))}
          </div>

          <div className="mt-6 flex w-full flex-col gap-4 sm:flex-row md:mx-auto md:mt-8 md:max-w-[420px] md:justify-center">
            <Button
              as="link"
              to="/browse"
              className="min-h-12 flex-1 px-6 py-3 text-[13px] font-bold transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(139,76,246,0.2)] md:text-[15px]"
            >
              Browse Items
            </Button>
            <Button
              as="link"
              to="/give"
              variant="secondary"
              className="min-h-12 flex-1 bg-white px-6 py-3 text-[13px] font-bold transition-all duration-300 hover:-translate-y-1 hover:border-[#ffcc22]/40 hover:shadow-[0_8px_20px_rgba(255,204,34,0.15)] md:text-[15px]"
            >
              List Item
            </Button>
          </div>

          <div className="mt-4 md:mt-5">
            <RatingStars
              rating={myReputation?.average_rating || 0}
              reviewCount={myReputation?.review_count || 0}
            />
          </div>
        </div>

        <div className="flex items-center gap-5 border-t border-[#efe8da] bg-[#faf7f1]/40 px-5 py-3 md:px-8">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/70">Listed Items</p>
            <p className="text-xs font-bold text-[#1f1f1f]">{items.length}</p>
          </div>
          <div className="h-3 w-px bg-[#efe8da]" />
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/70">Total Requests</p>
            <p className="text-xs font-bold text-[#1f1f1f]">{myRequests.length}</p>
          </div>
          {ownerRequests.length > 0 ? (
            <>
              <div className="h-3 w-px bg-[#efe8da]" />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/70">To Review</p>
                <p className="text-xs font-bold text-[#8b4cf6]">{ownerRequests.length}</p>
              </div>
            </>
          ) : null}
        </div>
      </Surface>

      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {STEPS.map((step, index) => (
          <HowItWorksStep
            key={step.number}
            number={step.number}
            title={step.title}
            description={step.description}
            isActive={stepIndex === index}
          />
        ))}
      </div>

      <div className="space-y-3 md:space-y-4">
        <SectionHeading
          title="Recent Items"
          description="Recently listed by the community."
          action={<Button as="link" to="/browse" variant="ghost" className="h-7 min-h-0 px-2 text-[9px]">See all</Button>}
        />

        {loadingItems ? <p className="text-[11px] text-[#68766d]">Loading listings...</p> : null}
        {itemsError ? <p className="text-[11px] font-medium text-[#c65d4a]">{itemsError}</p> : null}

        {!loadingItems && !itemsError && recentItems.length === 0 ? (
          <EmptyState
            title="No items yet"
            description="Be the first to share something with the community."
            action={<Button as="link" to="/give">List Item</Button>}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-6">
          {recentItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              currentUser={currentUser}
              myRequest={getMyRequestForItem(item.id)}
              reviewContext={getReviewContextForItem(item)}
              onCreateRequest={onCreateRequest}
              onOpenReview={onOpenReview}
              compact
            />
          ))}
        </div>
      </div>
    </div>
  )
}
