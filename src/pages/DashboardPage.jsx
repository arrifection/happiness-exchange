import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { asArray } from '../lib/api.js'
import LevelProgressBar from '../components/LevelProgressBar.jsx'
import { RatingStars, ReviewEmptyState } from '../components/reputation.jsx'
import TrustBadge from '../components/TrustBadge.jsx'
import TrustLevelLadder from '../components/TrustLevelLadder.jsx'
import { Button, EmptyState, ErrorState, RequestCardSkeletonList, SectionHeading, StatusBadge, Surface, InlineLoadingNotice } from '../components/ui.jsx'
import { ArrangeDeliveryModal, AddDeliveryAddressModal } from '../components/delivery/DeliveryModals.jsx'

function StatCard({ label, value, onClick, highlight, to }) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (to) navigate(to)
    if (onClick) onClick()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group he-stat-card flex w-full flex-col items-center justify-center p-4 text-center md:p-5
        hover:-translate-y-0.5 active:scale-[0.97]
        ${highlight
          ? 'cursor-pointer border-transparent bg-gradient-to-br from-he-purple to-[#7340d2] shadow-md hover:from-he-purple hover:to-he-purple-hover dark:shadow-[0_8px_24px_-8px_rgba(139,92,246,0.45)]'
          : 'cursor-pointer hover:border-he-purple/40'
        }`}
    >
      <p className={`mb-1 text-[10px] font-bold uppercase tracking-wider md:text-[11px] ${highlight ? 'text-white/90' : 'text-he-muted'}`}>
        {label}
      </p>
      <p className={`text-2xl font-bold md:text-3xl ${highlight ? 'text-white' : 'text-he-ink'}`}>
        {value}
      </p>
      <div className={`mt-1.5 flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider transition-opacity ${highlight ? 'text-white/70 group-hover:text-white' : 'text-he-purple/0 group-hover:text-he-purple'}`}>
        <span>View</span>
        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

function RequestCard({ request, children }) {
  return (
    <article className="he-card rounded-card p-3.5 transition-colors hover:bg-he-surface-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="min-w-0 font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold text-he-ink">{request.item_title}</h3>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-he-muted">
            {request.requester_name ? `Requester: ${request.requester_name.split(' ')[0]}` : 'Personal request'}
          </p>
        </div>
        <div className="shrink-0 scale-90 origin-top-right">
          <StatusBadge status={request.status} />
        </div>
      </div>
      {children}
    </article>
  )
}

export default function DashboardPage({
  currentUser,
  items,
  myReputation,
  myItems,
  myRequests,
  ownerRequests,
  onRequestAction,
  onOpenReview,
  onOpenChat,
  getReviewContextForMyRequest,
  getReviewContextForOwnerRequest,
  getChatConversationForRequest,
  loadingRequests,
  requestsMessage,
  requestsError,
  myDeliveries,
  loadRequestData,
  token
}) {
  const [arrangeDeliveryRequest, setArrangeDeliveryRequest] = useState(null)
  const [addAddressDelivery, setAddAddressDelivery] = useState(null)

  const requestList = asArray(myRequests)
  const incomingRequests = asArray(ownerRequests)
  const deliveries = asArray(myDeliveries)
  const displayName = currentUser?.name?.split(' ')[0] || 'Friend'

  const itemsSharedCount = myItems?.length || 0
  const itemsRequestedCount = requestList.length
  const completedExchangesCount = myReputation?.completed_exchange_count || 0
  const trustPoints = myReputation?.trust_score || 0
  const reviewCount = myReputation?.review_count || 0
  const trustLevel = myReputation?.level || 'New Member'

  if (!currentUser) {
    return (
      <Surface className="p-5">
        <h1 className="text-lg font-bold tracking-tight text-he-ink">Please log in</h1>
        <p className="mt-2 text-xs leading-relaxed text-he-muted">
          Your account dashboard appears after sign in.
        </p>
      </Surface>
    )
  }

  return (
    <div className="space-y-6 md:space-y-8 md:max-w-5xl md:mx-auto md:px-4">
      {/* Welcome Banner */}
      <section className="flex flex-col gap-4 md:flex-row md:gap-6">
        <div className="flex flex-1 flex-col justify-center he-hero-panel">
          <p className="text-[10px] font-bold uppercase tracking-widest text-he-soft md:text-xs">
            Community Member
          </p>
          <h1 className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold tracking-tight text-he-ink md:text-3xl">
            Welcome back, {displayName}
          </h1>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-he-muted md:text-sm">
            Give, receive, and connect — anonymously and with trust at the heart of every exchange.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TrustBadge
              level={trustLevel}
              trustScore={trustPoints}
              nextLevelPoints={myReputation?.next_level_points}
            />
          </div>
          <div className="mt-3">
            {reviewCount > 0 ? (
              <RatingStars
                rating={myReputation?.average_rating || 0}
                reviewCount={reviewCount}
              />
            ) : (
              <ReviewEmptyState
                title="No reviews yet"
                description="Complete an exchange to start building your community rating."
                className="max-w-md text-left"
              />
            )}
          </div>
          <div className="mt-4 max-w-md">
            <LevelProgressBar
              currentLevel={trustLevel}
              trustScore={trustPoints}
              nextLevelPts={myReputation?.next_level_points}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button as="link" to="/browse" className="h-10 px-6 text-[12px] transition-shadow hover:shadow-md md:text-[13px]">
              Browse Items
            </Button>
            <Button as="link" to="/give" variant="secondary" className="h-10 px-6 text-[12px] md:text-[13px]">
              List Item
            </Button>
            <Button as="link" to="/needs" variant="ghost" className="h-10 px-6 text-[12px] md:text-[13px]">
              Community Needs
            </Button>
          </div>
        </div>

        {/* Clickable Stat Cards */}
        <div className="grid shrink-0 grid-cols-2 gap-3 md:w-80 md:gap-4">
          <StatCard
            label="Items Shared"
            value={itemsSharedCount}
            to="/give"
          />
          <StatCard
            label="Requested"
            value={itemsRequestedCount}
            to="/requests"
          />
          <StatCard
            label="Completed"
            value={completedExchangesCount}
            to="/reputation"
          />
          <StatCard
            label="Trust Points"
            value={trustPoints}
            to="/reputation"
            highlight
          />
        </div>
      </section>

      <Surface className="p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-he-ink md:text-base">Your trust journey</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-he-muted">
              Earn points by donating, receiving, and getting positive reviews.
            </p>
          </div>
          <Button as="link" to="/reputation" variant="ghost" className="h-8 min-h-0 shrink-0 px-3 text-[10px]">
            View full reputation
          </Button>
        </div>
        <div className="mt-4">
          <TrustLevelLadder level={trustLevel} trustScore={trustPoints} compact />
        </div>
      </Surface>

      {/* Messages / Feedback */}
      {requestsMessage ? (
        <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-he-purple">{requestsMessage}</p>
      ) : null}
      {requestsError ? (
        <ErrorState
          title="Couldn't load your activity"
          message={requestsError}
          onRetry={() => loadRequestData?.()}
          className="mx-0"
        />
      ) : null}

      {arrangeDeliveryRequest && (
        <ArrangeDeliveryModal
          request={arrangeDeliveryRequest}
          token={token}
          onComplete={(newDelivery) => {
            setArrangeDeliveryRequest(null)
            loadRequestData()
          }}
          onCancel={() => setArrangeDeliveryRequest(null)}
        />
      )}

      {addAddressDelivery && (
        <AddDeliveryAddressModal
          delivery={addAddressDelivery}
          token={token}
          onComplete={(updatedDelivery) => {
            setAddAddressDelivery(null)
            loadRequestData()
          }}
          onCancel={() => setAddAddressDelivery(null)}
        />
      )}

      <div className="flex flex-col gap-6 md:gap-8 lg:flex-row">
        {/* My Requests */}
        <div className="flex-1 space-y-4 md:space-y-5">
          <SectionHeading
            title="Items you requested"
            description="Your active requests for community items."
          />
          <div className="grid grid-cols-1 gap-3 md:gap-5 sm:grid-cols-2">
            {loadingRequests && requestList.length === 0 ? (
              <RequestCardSkeletonList count={2} className="sm:col-span-2" />
            ) : requestList.length === 0 ? (
              <EmptyState
                icon="requests"
                title="No active requests"
                description="When you request an item from Browse, it will appear here so you can track progress."
                action={<Button as="link" to="/browse">Browse items</Button>}
              />
            ) : (
              <>
                {loadingRequests ? <InlineLoadingNotice label="Updating requests…" className="sm:col-span-2" /> : null}
                {requestList.map((request) => {
                const reviewContext = getReviewContextForMyRequest?.(request)
                const convId = getChatConversationForRequest?.(request.id)
                return (
                  <RequestCard key={request.id} request={request}>
                    <div className="mt-2.5 flex flex-col gap-1.5 border-t border-he-border/60 pt-2">
                      {request.status === 'approved' && (() => {
                        const delivery = deliveries.find((d) => d.request_id === request.id)
                        if (delivery) {
                          if (delivery.status === 'awaiting_dropoff_address' && delivery.receiver_id === currentUser.id) {
                            return (
                              <Button
                                className="h-7 min-h-0 flex-1 rounded-btn text-[10px] bg-[#1f1f1f] text-white"
                                onClick={() => setAddAddressDelivery(delivery)}
                              >
                                📍 Add Delivery Address
                              </Button>
                            )
                          }
                          return (
                            <Button
                              as="link"
                              to={`/deliveries/${delivery.id}`}
                              className="h-7 min-h-0 flex-1 rounded-btn text-[10px] bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd]"
                            >
                              🚚 Track Delivery
                            </Button>
                          )
                        }
                        return null
                      })()}
                      {request.status === 'approved' && convId && (
                        <Button
                          as="link"
                          to={`/messages/${convId}`}
                          className="h-7 min-h-0 flex-1 rounded-btn text-[10px] bg-[#8b4cf6] text-white"
                        >
                          💬 Open Chat
                        </Button>
                      )}
                      {reviewContext ? (
                        <Button
                          className="h-7 min-h-0 flex-1 rounded-btn text-[10px]"
                          variant="secondary"
                          onClick={() => onOpenReview?.(reviewContext)}
                        >
                          Leave Review
                        </Button>
                      ) : null}
                    </div>
                  </RequestCard>
                )
              })}
              </>
            )}
          </div>
        </div>

        {/* Incoming Requests */}
        <div className="shrink-0 space-y-4 md:space-y-5 lg:w-80">
          <SectionHeading
            title="Review incoming"
            description="Approve or decline requests."
            action={<Button as="link" to="/requests" variant="ghost" className="h-8 min-h-0 px-3 text-[10px]">View all</Button>}
          />
          <div className="flex flex-col gap-3">
            {loadingRequests && incomingRequests.length === 0 ? (
              <RequestCardSkeletonList count={2} className="grid-cols-1" />
            ) : incomingRequests.length === 0 ? (
              <EmptyState
                icon="requests"
                title="No pending reviews"
                description="When someone requests one of your items, you can approve or decline it here."
                action={<Button as="link" to="/give">View your listings</Button>}
              />
            ) : (
              <>
                {loadingRequests ? <InlineLoadingNotice label="Updating incoming requests…" /> : null}
                {incomingRequests.slice(0, 5).map((request) => {
                const reviewContext = getReviewContextForOwnerRequest?.(request)
                const convId = getChatConversationForRequest?.(request.id)
                return (
                  <RequestCard key={request.id} request={request}>
                    {request.status === 'pending' ? (
                      <div className="mt-2.5 flex gap-1.5 border-t border-he-border/60 pt-2">
                        <Button className="h-7 min-h-0 flex-1 rounded-btn text-[10px]" onClick={() => onRequestAction?.(request.id, 'approve')}>Approve</Button>
                        <Button className="h-7 min-h-0 flex-1 rounded-btn text-[10px]" variant="secondary" onClick={() => onRequestAction?.(request.id, 'reject')}>Decline</Button>
                      </div>
                    ) : null}
                    {request.status === 'approved' && (() => {
                      const delivery = deliveries.find((d) => d.request_id === request.id)
                      if (!delivery) {
                        return (
                          <div className="mt-1.5 flex gap-1.5">
                            <Button
                              className="h-7 min-h-0 flex-1 rounded-btn text-[10px] bg-[#1f1f1f] text-white"
                              onClick={() => setArrangeDeliveryRequest(request)}
                            >
                              📦 Arrange Delivery
                            </Button>
                          </div>
                        )
                      }
                      return (
                        <div className="mt-1.5 flex gap-1.5">
                          <Button
                            as="link"
                            to={`/deliveries/${delivery.id}`}
                            className="h-7 min-h-0 flex-1 rounded-btn text-[10px] bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd]"
                          >
                            🚚 Track Delivery
                          </Button>
                        </div>
                      )
                    })()}
                    {request.status === 'approved' && convId && (
                      <div className="mt-1.5 flex gap-1.5">
                        <Button
                          as="link"
                          to={`/messages/${convId}`}
                          className="h-7 min-h-0 flex-1 rounded-btn text-[10px]"
                        >
                          💬 Open Chat
                        </Button>
                      </div>
                    )}
                    {reviewContext ? (
                      <div className="mt-1.5 flex gap-1.5">
                        <Button
                          className="h-7 min-h-0 flex-1 rounded-btn text-[10px]"
                          variant="secondary"
                          onClick={() => onOpenReview?.(reviewContext)}
                        >
                          Leave Review
                        </Button>
                      </div>
                    ) : null}
                  </RequestCard>
                )
              })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
