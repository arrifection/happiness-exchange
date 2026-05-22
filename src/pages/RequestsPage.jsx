import { useMemo, useState } from 'react'

import { Button, EmptyState, StatusBadge, Surface } from '../components/ui.jsx'

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

function RequestCard({ request, item, onRequestAction, children }) {
  return (
    <article className="group flex overflow-hidden rounded-card border border-[#efe8da] bg-white transition-all duration-300 hover:shadow-xs">
      <div className="relative aspect-square w-22 shrink-0 overflow-hidden bg-[#faf7f1] sm:w-26">
        {item?.image_url ? (
          <img
            src={item.image_url}
            alt={request.item_title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/40">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3">
        <div className="space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold leading-tight text-[#1f1f1f]">
              {request.item_title}
            </h3>
            <div className="origin-top-right shrink-0 scale-90">
              <StatusBadge status={request.status} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-tight text-[#8c755f]/70">
            <span>By {request.requester_name.split(' ')[0]}</span>
            <span className="opacity-40">/</span>
            <span>{formatRequestDate(request.created_at)}</span>
          </div>
        </div>

        {request.status === 'pending' ? (
          <div className="mt-2 flex gap-1.5 border-t border-[#fcfbf9] pt-2">
            <Button className="h-7 min-h-0 flex-1 rounded-btn text-[10px]" onClick={() => onRequestAction(request.id, 'approve')}>Approve</Button>
            <Button className="h-7 min-h-0 flex-1 rounded-btn text-[10px]" variant="secondary" onClick={() => onRequestAction(request.id, 'reject')}>Decline</Button>
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
}) {
  const [activeFilter, setActiveFilter] = useState('all')

  const itemLookup = useMemo(
    () => Object.fromEntries(myItems.map((item) => [item.id, item])),
    [myItems],
  )

  const visibleRequests = activeFilter === 'all'
    ? ownerRequests
    : ownerRequests.filter((request) => request.status === activeFilter)

  if (!currentUser) {
    return (
      <Surface className="p-5">
        <h1 className="text-lg font-bold tracking-tight text-[#1f1f1f]">Please log in</h1>
        <p className="mt-2 text-xs leading-relaxed text-[#68766d]">
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
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-[#1f1f1f] md:text-xl">
              Incoming Requests
            </h1>
            <p className="text-[10px] text-[#68766d] md:text-xs">Review neighbors who are interested in your items.</p>
          </div>
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
                  isActive
                    ? 'bg-[#8b4cf6] text-white shadow-xs'
                    : 'border border-[#efe8da] bg-[#fffdfb] text-[#8c755f] hover:text-[#1f1f1f]',
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
          {loadingRequests ? <p className="text-[9px] font-bold uppercase tracking-widest text-[#68766d]">Refreshing...</p> : null}
          {requestsMessage ? <p className="text-[9px] font-bold uppercase tracking-widest text-[#8b4cf6]">{requestsMessage}</p> : null}
          {requestsError ? <p className="text-[9px] font-bold uppercase tracking-widest text-[#c65d4a]">{requestsError}</p> : null}
        </div>
      ) : null}

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
                  onRequestAction={onRequestAction}
                >
                  {reviewContext ? (
                    <div className="mt-2 flex gap-1.5 border-t border-[#fcfbf9] pt-2">
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
