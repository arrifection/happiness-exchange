import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import ItemCard from '../components/ItemCard.jsx'
import { asArray } from '../lib/api.js'
import TrustBadge from '../components/TrustBadge.jsx'
import { Button, EmptyState, ErrorState, ItemCardSkeletonGrid, SectionHeading, Surface } from '../components/ui.jsx'

import './AuthenticatedHomePage.css'

const TAGLINES = [
  'Give what you can. Find what you need.',
  'Share with kindness. Receive with dignity.',
  'Something you no longer need can bring comfort to someone else.',
  'What feels extra to you may mean everything to someone in need.',
  'A simple way to help your community.',
]

const TAGLINE_FADE_MS = 1000
const TAGLINE_HOLD_MS = 6500
const TAGLINE_PAUSE_MS = 400

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
          ? 'z-10 scale-[1.02] border-he-purple/40 bg-he-surface shadow-[0_0_16px_rgba(139,76,246,0.12),0_0_12px_rgba(255,204,34,0.08)] md:scale-105 dark:shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_12px_32px_-12px_rgba(0,0,0,0.55)]'
          : 'z-0 scale-100 border-he-border bg-he-surface-soft shadow-none dark:bg-he-elevated/60',
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
      <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[12px] font-bold text-he-ink md:text-[15px]">
        {title}
      </h3>
      <p className="text-[10px] leading-relaxed text-he-muted md:text-[12px]">{description}</p>
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
  onRefreshItems,
  myRequests,
  onDeleteItem,
  onCompleteItem,
  onRenewItem,
  onChangeListingMode,
  ownerActionItemId,
}) {
  const [taglineIndex, setTaglineIndex] = useState(0)
  const [taglineVisible, setTaglineVisible] = useState(true)
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    let fadeTimeout
    let swapTimeout
    let holdTimeout

    const scheduleNext = () => {
      holdTimeout = window.setTimeout(() => {
        setTaglineVisible(false)

        fadeTimeout = window.setTimeout(() => {
          setTaglineIndex((index) => (index + 1) % TAGLINES.length)

          swapTimeout = window.setTimeout(() => {
            setTaglineVisible(true)
            scheduleNext()
          }, TAGLINE_PAUSE_MS)
        }, TAGLINE_FADE_MS)
      }, TAGLINE_HOLD_MS)
    }

    scheduleNext()

    return () => {
      window.clearTimeout(holdTimeout)
      window.clearTimeout(fadeTimeout)
      window.clearTimeout(swapTimeout)
    }
  }, [])

  useEffect(() => {
    const stepsInterval = window.setInterval(() => {
      setStepIndex((index) => (index + 1) % STEPS.length)
    }, 3500)

    return () => {
      window.clearInterval(stepsInterval)
    }
  }, [])

  const recentItems = asArray(items).slice(0, 4)
  const displayName = currentUser?.name?.split(' ')[0] || 'Friend'

  return (
    <div className="space-y-4 md:space-y-6">
      <Surface className="overflow-hidden p-0 shadow-none">
        <div className="he-auth-hero">
          <div className="he-auth-hero-inner md:flex md:flex-col md:items-center md:text-center">
            <span className="he-auth-hero-eyebrow">Welcome back, {displayName}</span>

            <div className="mt-3 flex flex-wrap items-center gap-2 md:justify-center">
              <TrustBadge
                level={myReputation?.level}
                trustScore={myReputation?.trust_score}
                nextLevelPoints={myReputation?.next_level_points}
              />
            </div>

            <div className="he-auth-tagline-wrap" aria-live="polite" aria-atomic="true">
              <h1
                className={[
                  'he-auth-tagline',
                  taglineVisible ? 'is-visible' : 'is-fading',
                ].join(' ')}
              >
                {TAGLINES[taglineIndex]}
              </h1>
            </div>

            <div className="he-auth-cta-row">
              <Link to="/browse" className="he-auth-cta-primary">
                Browse
              </Link>
              <Link to="/give" className="he-auth-cta-secondary">
                Give Away
              </Link>
              <Link to="/swaps" className="he-auth-cta-secondary">
                Exchange
              </Link>
              <Link to="/deliveries" className="he-auth-cta-secondary">
                Delivery
              </Link>
            </div>
          </div>

          <div className="he-auth-stats">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-he-soft/70">Listed Items</p>
              <p className="text-xs font-bold text-he-ink">{items.length}</p>
            </div>
            <div className="hidden h-3 w-px bg-he-border sm:block" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-he-soft/70">Total Requests</p>
              <p className="text-xs font-bold text-he-ink">{asArray(myRequests).length}</p>
            </div>
          </div>
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:gap-4">
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

        {loadingItems ? (
          <ItemCardSkeletonGrid count={2} />
        ) : itemsError ? (
          <ErrorState
            title="Couldn't load recent items"
            message={itemsError}
            onRetry={() => onRefreshItems?.()}
          />
        ) : recentItems.length === 0 ? (
          <EmptyState
            icon="items"
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
              onDeleteItem={onDeleteItem}
              onCompleteItem={onCompleteItem}
              onRenewItem={onRenewItem}
              onChangeListingMode={onChangeListingMode}
              ownerActionPending={ownerActionItemId === item.id}
              compact
            />
          ))}
        </div>
      </div>
    </div>
  )
}
