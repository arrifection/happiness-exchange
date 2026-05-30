import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { asArray } from '../lib/api.js'
import { resolveItemImageUrl, ITEM_PLACEHOLDER_URL } from '../lib/itemImages.js'
import IncomingRequestReview from '../components/IncomingRequestReview.jsx'
import {
  Button,
  EmptyState,
  ErrorState,
  RequestCardSkeletonList,
  InlineLoadingNotice,
  StatusBadge,
  Surface,
} from '../components/ui.jsx'

const FILTERS = ['all', 'pending', 'approved', 'rejected']
const VIEW_TABS = [
  { id: 'mine', label: 'My Requests' },
  { id: 'incoming', label: 'Incoming' },
]

function formatRequestDate(value) {
  if (!value) return 'Recently'

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return 'Recently'

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate)
}

function filterByStatus(requests, activeFilter) {
  if (activeFilter === 'all') return requests
  return requests.filter((request) => request.status === activeFilter)
}

function RequestCardShell({ request, item, children }) {
  return (
    <article className="group flex overflow-hidden rounded-card border border-he-border bg-he-surface shadow-sm transition-all duration-300 hover:border-he-purple/30 hover:shadow-md">
      <Link
        to={`/items/${request.item_id}`}
        className="relative aspect-square w-20 shrink-0 overflow-hidden bg-he-surface-soft sm:w-24"
        aria-label={`View ${request.item_title}`}
      >
        <img
          src={resolveItemImageUrl(item?.image_url)}
          alt={request.item_title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.src = ITEM_PLACEHOLDER_URL
          }}
        />
      </Link>

      <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3">
        <div className="space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/items/${request.item_id}`}
              className="line-clamp-1 font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold leading-tight text-he-ink hover:text-he-purple"
            >
              {request.item_title}
            </Link>
            <div className="origin-top-right shrink-0 scale-90">
              <StatusBadge status={request.status} />
            </div>
          </div>
          {children.meta}
        </div>
        {children.actions}
      </div>
    </article>
  )
}

export default function RequestsPage({
  currentUser,
  items,
  myRequests,
  ownerRequests,
  myItems,
  onOpenReview,
  getReviewContextForMyRequest,
  getReviewContextForOwnerRequest,
  getChatConversationForRequest,
  loadingRequests,
  requestsMessage,
  requestsError,
  onRequestAction,
  onCancelRequest,
  cancelPendingRequestId,
  loadRequestData,
}) {
  const [activeView, setActiveView] = useState('mine')
  const [activeFilter, setActiveFilter] = useState('all')

  const safeMyRequests = asArray(myRequests)
  const safeOwnerRequests = asArray(ownerRequests)
  const safeMyItems = asArray(myItems)
  const safeBrowseItems = asArray(items)

  const itemLookup = useMemo(
    () => Object.fromEntries(
      [...safeMyItems, ...safeBrowseItems].map((item) => [item.id, item]),
    ),
    [safeMyItems, safeBrowseItems],
  )

  const sourceRequests = activeView === 'mine' ? safeMyRequests : safeOwnerRequests
  const visibleRequests = filterByStatus(sourceRequests, activeFilter)

  const pendingMineCount = safeMyRequests.filter((request) => request.status === 'pending').length
  const pendingIncomingCount = safeOwnerRequests.filter((request) => request.status === 'pending').length

  if (!currentUser) {
    return (
      <Surface className="p-5">
        <h1 className="text-lg font-bold tracking-tight text-he-ink">Please log in</h1>
        <p className="mt-2 text-xs leading-relaxed text-he-muted">
          Sign in to track your requests and review incoming interest on your listings.
        </p>
      </Surface>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-he-ink md:text-xl">
            Activity
          </h1>
          <p className="text-[10px] text-he-muted md:text-xs">
            Track items you requested and review interest on your listings.
          </p>
        </div>

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar scroll-smooth md:mx-0 md:px-0">
          {VIEW_TABS.map((tab) => {
            const isActive = activeView === tab.id
            const badgeCount = tab.id === 'mine' ? pendingMineCount : pendingIncomingCount
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id)}
                className={[
                  'relative shrink-0 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 md:text-[11px]',
                  isActive ? 'he-chip-active' : 'he-chip',
                ].join(' ')}
              >
                {tab.label}
                {badgeCount > 0 ? (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-he-purple px-1 text-[8px] font-bold text-white">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="-mx-4 flex flex-wrap gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar scroll-smooth md:mx-0 md:flex-nowrap md:justify-start md:overflow-x-visible md:px-0 md:pb-0">
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

      {requestsMessage ? (
        <p className="pt-1 text-[10px] font-bold uppercase tracking-widest text-he-purple">{requestsMessage}</p>
      ) : null}

      {requestsError ? (
        <ErrorState
          title="Couldn't load activity"
          message={requestsError}
          onRetry={() => loadRequestData?.()}
        />
      ) : null}

      <div className="space-y-3 pt-1 md:pt-4">
        {loadingRequests && visibleRequests.length === 0 ? (
          <RequestCardSkeletonList count={4} />
        ) : !loadingRequests && visibleRequests.length === 0 ? (
          <div className="flex w-full justify-center md:px-8">
            <EmptyState
              icon="requests"
              title={
                activeView === 'mine'
                  ? activeFilter === 'pending'
                    ? 'No pending requests'
                    : activeFilter === 'approved'
                      ? 'No approved requests'
                      : activeFilter === 'rejected'
                        ? 'No declined requests'
                        : 'You have not requested any items yet'
                  : activeFilter === 'pending'
                    ? 'No pending incoming requests'
                    : activeFilter === 'approved'
                      ? 'No approved incoming requests'
                      : activeFilter === 'rejected'
                        ? 'No declined incoming requests'
                        : 'No incoming requests yet'
              }
              description={
                activeView === 'mine'
                  ? 'When you request an item from Browse, it will appear here so you can track or cancel it.'
                  : 'When neighbors request your listed items, they will appear here for you to review.'
              }
              action={
                activeView === 'mine'
                  ? <Button as="link" to="/browse">Browse items</Button>
                  : <Button as="link" to="/give">View your listings</Button>
              }
            />
          </div>
        ) : (
          <>
            {loadingRequests ? <InlineLoadingNotice label="Updating activity…" /> : null}
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-6">
              {visibleRequests.map((request) => {
                if (activeView === 'mine') {
                  const reviewContext = getReviewContextForMyRequest?.(request)
                  const convId = getChatConversationForRequest?.(request.id, request)

                  return (
                    <RequestCardShell
                      key={request.id}
                      request={request}
                      item={itemLookup[request.item_id]}
                    >
                      {{
                        meta: (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-tight text-he-muted">
                              <span>Requested {formatRequestDate(request.created_at)}</span>
                            </div>
                            {request.reason ? (
                              <p className="line-clamp-3 text-[11px] italic leading-relaxed text-he-muted">
                                &ldquo;{request.reason}&rdquo;
                              </p>
                            ) : null}
                          </div>
                        ),
                        actions: (
                          <div className="mt-2 space-y-1.5 border-t border-he-border/60 pt-2">
                            {request.status === 'pending' ? (
                              <Button
                                className="h-7 min-h-0 w-full rounded-btn text-[10px]"
                                variant="danger"
                                disabled={cancelPendingRequestId === request.id}
                                onClick={() => onCancelRequest?.(request.id)}
                              >
                                {cancelPendingRequestId === request.id ? 'Cancelling…' : 'Cancel Request'}
                              </Button>
                            ) : null}
                            {request.status === 'approved' && convId ? (
                              <Button
                                as="link"
                                to={`/messages/${convId}`}
                                className="h-7 min-h-0 w-full rounded-btn text-[10px] bg-he-purple text-white"
                              >
                                Open Messages
                              </Button>
                            ) : null}
                            {reviewContext ? (
                              <Button
                                className="h-7 min-h-0 w-full rounded-btn text-[10px]"
                                variant="secondary"
                                onClick={() => onOpenReview(reviewContext)}
                              >
                                Leave Review
                              </Button>
                            ) : null}
                          </div>
                        ),
                      }}
                    </RequestCardShell>
                  )
                }

                const reviewContext = getReviewContextForOwnerRequest?.(request)
                const convId = getChatConversationForRequest?.(request.id, request)

                return (
                  <RequestCardShell
                    key={request.id}
                    request={request}
                    item={itemLookup[request.item_id]}
                  >
                    {{
                      meta: <IncomingRequestReview request={request} />,
                      actions: (
                        <div className="mt-2 space-y-1.5 border-t border-he-border/60 pt-2">
                          {request.status === 'pending' ? (
                            <div className="flex gap-1.5">
                              <Button className="h-7 min-h-0 flex-1 rounded-btn text-[10px]" onClick={() => onRequestAction(request.id, 'approve')}>
                                Approve
                              </Button>
                              <Button className="h-7 min-h-0 flex-1 rounded-btn text-[10px]" variant="secondary" onClick={() => onRequestAction(request.id, 'reject')}>
                                Decline
                              </Button>
                            </div>
                          ) : null}
                          {request.status === 'approved' && convId ? (
                            <Button
                              as="link"
                              to={`/messages/${convId}`}
                              className="h-7 min-h-0 w-full rounded-btn text-[10px] bg-he-purple text-white"
                            >
                              Open Messages
                            </Button>
                          ) : null}
                          {reviewContext ? (
                            <Button
                              className="h-7 min-h-0 w-full rounded-btn text-[10px]"
                              variant="secondary"
                              onClick={() => onOpenReview(reviewContext)}
                            >
                              Leave Review
                            </Button>
                          ) : null}
                        </div>
                      ),
                    }}
                  </RequestCardShell>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
