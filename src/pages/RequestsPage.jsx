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

function RequestCard({ request, item, onRequestAction }) {
  return (
    <article className="group flex overflow-hidden rounded-2xl border border-[#eadfce] bg-white transition-all duration-300 hover:shadow-md">
      <div className="relative aspect-square w-20 shrink-0 overflow-hidden bg-[#f4efe7] sm:w-24">
        {item?.image_url ? (
          <img
            src={item.image_url}
            alt={request.item_title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/50">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between p-3 sm:p-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold leading-tight text-[#1f3328] line-clamp-1 sm:text-[14px]">{request.item_title}</h3>
            <StatusBadge status={request.status} />
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">
            <span>{request.requester_name.split(' ')[0]}</span>
            <span>•</span>
            <span>{formatRequestDate(request.created_at)}</span>
          </div>
        </div>

        {request.status === 'pending' ? (
          <div className="mt-3 flex gap-2 border-t border-[#f4efe7] pt-3">
            <Button className="flex-1 h-8 min-h-0 text-[10px]" onClick={() => onRequestAction(request.id, 'approve')}>Approve</Button>
            <Button className="flex-1 h-8 min-h-0 text-[10px]" variant="danger" onClick={() => onRequestAction(request.id, 'reject')}>Decline</Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default function RequestsPage({
  currentUser,
  ownerRequests,
  myItems,
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
      <Surface className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-[#1f3328]">Please log in</h1>
        <p className="mt-2 text-xs leading-relaxed text-[#68766d]">
          Sign in to review requests for your listings.
        </p>
      </Surface>
    )
  }

  return (
    <div className="space-y-6">
      <Surface className="p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1f6f50]">Community Activity</p>
        <h1 className="mt-2 font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold tracking-tight text-[#1f3328]">
          Incoming Requests
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-[#68766d]">
          Review neighbors who are interested in your items.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`rounded-xl px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                activeFilter === filter
                  ? 'bg-[#1f6f50] text-white shadow-lg shadow-[#1f6f50]/15'
                  : 'bg-[#faf7f1] text-[#8c755f] hover:bg-[#f4efe7] hover:text-[#1f3328]'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </Surface>

      {(loadingRequests || requestsMessage || requestsError) ? (
        <div className="space-y-2">
          {loadingRequests ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#68766d]">Refreshing...</p> : null}
          {requestsMessage ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#1f6f50]">{requestsMessage}</p> : null}
          {requestsError ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#c65d4a]">{requestsError}</p> : null}
        </div>
      ) : null}

      <div className="space-y-4">
        {!loadingRequests && visibleRequests.length === 0 ? (
          <EmptyState
            title={
              activeFilter === 'pending'
                ? 'No pending requests 🌱'
                : activeFilter === 'approved'
                  ? 'No approved requests'
                  : activeFilter === 'rejected'
                    ? 'No rejected requests'
                    : 'No requests yet'
            }
            description="Requests will appear here as neighbors respond to your items."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visibleRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                item={itemLookup[request.item_id]}
                onRequestAction={onRequestAction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
