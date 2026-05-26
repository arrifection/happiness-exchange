import { useMemo, useState } from 'react'

import { asArray } from '../lib/api.js'
import { resolveItemImageUrl, ITEM_PLACEHOLDER_URL } from '../lib/itemImages.js'
import { Button, EmptyState, StatusBadge, Surface } from '../components/ui.jsx'
import { ArrangeDeliveryModal } from '../components/delivery/DeliveryModals.jsx'

const FILTERS = ['all', 'pending', 'approved', 'rejected']

function formatRequestDate(value) {
  if (!value) {
    return 'Recently'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Recently'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate)
}

function RequestCard({ request, item, delivery, onRequestAction, onArrangeDelivery, children }) {
  return (
    <article className="group flex overflow-hidden rounded-card border border-he-border bg-he-surface shadow-sm transition-all duration-300 hover:border-he-purple/30 hover:shadow-md">
      <div className="relative aspect-square w-22 shrink-0 overflow-hidden bg-he-surface-soft sm:w-26">
        <img
          src={resolveItemImageUrl(item?.image_url)}
          alt={request.item_title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.src = ITEM_PLACEHOLDER_URL
          }}
        />
      </div>

      <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3">
        <div className="space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold leading-tight text-he-ink">
              {request.item_title}
            </h3>
            <div className="origin-top-right shrink-0 scale-90">
              <StatusBadge status={request.status} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-tight text-he-muted">
            <span>By {request.requester_name.split(' ')[0]}</span>
            <span className="opacity-40">/</span>
            <span>{formatRequestDate(request.created_at)}</span>
          </div>
        </div>

        {request.status === 'pending' ? (
          <div className="mt-2 flex gap-1.5 border-t border-he-border/60 pt-2">
            <Button className="h-7 min-h-0 flex-1 rounded-btn text-[10px]" onClick={() => onRequestAction(request.id, 'approve')}>Approve</Button>
            <Button className="h-7 min-h-0 flex-1 rounded-btn text-[10px]" variant="secondary" onClick={() => onRequestAction(request.id, 'reject')}>Decline</Button>
          </div>
        ) : request.status === 'approved' ? (
          <div className="mt-2 flex gap-1.5 border-t border-he-border/60 pt-2">
            {!delivery ? (
              <Button
                className="h-7 min-h-0 flex-1 rounded-btn text-[10px] bg-[#1f1f1f] text-white"
                onClick={() => onArrangeDelivery(request)}
              >
                📦 Arrange Delivery
              </Button>
            ) : (
              <Button
                as="link"
                to={`/deliveries/${delivery.id}`}
                className="h-7 min-h-0 flex-1 rounded-btn text-[10px] bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd]"
              >
                🚚 Track Delivery
              </Button>
            )}
          </div>
        ) : null}

        {children}
      </div>
    </article>
  )
}

export default function RequestsPage({
  currentUser,
  ownerRequests,
  myItems,
  onOpenReview,
  getReviewContextForOwnerRequest,
  loadingRequests,
  requestsMessage,
  requestsError,
  onRequestAction,
  myDeliveries,
  loadRequestData,
  token
}) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [arrangeDeliveryRequest, setArrangeDeliveryRequest] = useState(null)

  const safeMyItems = asArray(myItems)
  const safeOwnerRequests = asArray(ownerRequests)
  const safeDeliveries = asArray(myDeliveries)

  const itemLookup = useMemo(
    () => Object.fromEntries(safeMyItems.map((item) => [item.id, item])),
    [safeMyItems],
  )

  const visibleRequests = activeFilter === 'all'
    ? safeOwnerRequests
    : safeOwnerRequests.filter((request) => request.status === activeFilter)

  if (!currentUser) {
    return (
      <Surface className="p-5">
        <h1 className="text-lg font-bold tracking-tight text-he-ink">Please log in</h1>
        <p className="mt-2 text-xs leading-relaxed text-he-muted">
          Sign in to review requests for your listings.
        </p>
      </Surface>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-he-ink md:text-xl">
              Incoming Requests
            </h1>
            <p className="text-[10px] text-he-muted md:text-xs">Review neighbors who are interested in your items.</p>
          </div>
          <Button as="link" to="/needs" variant="secondary" className="h-8 min-h-0 px-3 text-[10px]">
            Community Needs
          </Button>
        </div>

        <div className="-mx-4 flex flex-wrap gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar scroll-smooth md:mx-0 md:flex-nowrap md:justify-center md:gap-3 md:overflow-x-visible md:px-0 md:pb-0">
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={[
                  'shrink-0 rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 md:px-5 md:py-2 md:text-[11px]',
                  isActive ? 'he-chip-active' : 'he-chip',
                ].join(' ')}
              >
                {filter}
              </button>
            )
          })}
        </div>
      </div>

      {(loadingRequests || requestsMessage || requestsError) ? (
        <div className="space-y-1.5 pt-1">
          {loadingRequests ? <p className="text-[9px] font-bold uppercase tracking-widest text-he-muted">Refreshing...</p> : null}
          {requestsMessage ? <p className="text-[9px] font-bold uppercase tracking-widest text-he-purple">{requestsMessage}</p> : null}
          {requestsError ? <p className="text-[9px] font-bold uppercase tracking-widest text-he-danger">{requestsError}</p> : null}
        </div>
      ) : null}

      {arrangeDeliveryRequest && (
        <ArrangeDeliveryModal
          request={arrangeDeliveryRequest}
          token={token}
          onComplete={() => {
            setArrangeDeliveryRequest(null)
            loadRequestData()
          }}
          onCancel={() => setArrangeDeliveryRequest(null)}
        />
      )}

      <div className="space-y-3 pt-1 md:pt-4">
        {!loadingRequests && visibleRequests.length === 0 ? (
          <div className="flex w-full justify-center md:px-8">
            <EmptyState
              title={
                activeFilter === 'pending'
                  ? 'No pending requests yet'
                  : activeFilter === 'approved'
                    ? 'No approved requests'
                    : activeFilter === 'rejected'
                      ? 'No rejected requests'
                      : 'No requests yet'
              }
              description="Requests will appear here as neighbors respond to your items."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-6">
            {visibleRequests.map((request) => {
              const reviewContext = getReviewContextForOwnerRequest(request)
              return (
                <RequestCard
                  key={request.id}
                  request={request}
                  item={itemLookup[request.item_id]}
                  delivery={safeDeliveries.find((d) => d.request_id === request.id)}
                  onRequestAction={onRequestAction}
                  onArrangeDelivery={setArrangeDeliveryRequest}
                >
                  {reviewContext ? (
                    <div className="mt-2 flex gap-1.5 border-t border-he-border/60 pt-2">
                      <Button
                        className="h-7 min-h-0 flex-1 rounded-btn text-[10px]"
                        variant="secondary"
                        onClick={() => onOpenReview(reviewContext)}
                      >
                        Leave Review
                      </Button>
                    </div>
                  ) : null}
                </RequestCard>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
