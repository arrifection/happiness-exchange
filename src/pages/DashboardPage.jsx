import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { asArray } from '../lib/api.js'
import { RatingStars, ReputationBadge } from '../components/reputation.jsx'
import TrustBadge from '../components/TrustBadge.jsx'
import { Button, EmptyState, SectionHeading, StatusBadge, Surface } from '../components/ui.jsx'
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
      className={`group flex w-full flex-col items-center justify-center rounded-card border p-4 text-center shadow-xs transition-all duration-200 md:p-5
        hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(139,76,246,0.15)] active:scale-[0.97]
        ${highlight
          ? 'border-transparent bg-gradient-to-br from-[#8b4cf6] to-[#7340d2] cursor-pointer'
          : 'border-he-border/80 bg-he-surface cursor-pointer hover:border-he-purple/30'
        }`}
    >
      <p className={`mb-1 text-[9px] font-bold uppercase tracking-wider md:text-[10px] ${highlight ? 'text-white/80' : 'text-[#8c755f]/70'}`}>
        {label}
      </p>
      <p className={`text-2xl font-bold md:text-3xl ${highlight ? 'text-white' : 'text-[#1f1f1f]'}`}>
        {value}
      </p>
      <div className={`mt-1.5 flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider transition-opacity ${highlight ? 'text-white/60 group-hover:text-white/90' : 'text-[#8b4cf6]/0 group-hover:text-[#8b4cf6]/70'}`}>
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
    <article className="rounded-card border border-he-border bg-he-surface p-3.5 transition-colors hover:bg-he-surface-soft/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold text-[#1f1f1f]">{request.item_title}</h3>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/70">
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
  const trustPoints = (myReputation?.completed_shared_count || 0) * 10 + completedExchangesCount * 50

  if (!currentUser) {
    return (
      <Surface className="p-5">
        <h1 className="text-lg font-bold tracking-tight text-[#1f1f1f]">Please log in</h1>
        <p className="mt-2 text-xs leading-relaxed text-[#68766d]">
          Your account dashboard appears after sign in.
        </p>
      </Surface>
    )
  }

  return (
    <div className="space-y-6 md:space-y-8 md:max-w-5xl md:mx-auto md:px-4">
      {/* Welcome Banner */}
      <section className="flex flex-col gap-4 md:flex-row md:gap-6">
        <div className="flex flex-1 flex-col justify-center rounded-[24px] border border-[#efe8da]/80 bg-gradient-to-br from-[#8b4cf6]/10 to-[#ffcc22]/20 p-5 shadow-xs md:p-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/80 md:text-xs">
            Community Member
          </p>
          <h1 className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold tracking-tight text-[#1f1f1f] md:text-3xl">
            Welcome back, {displayName}
          </h1>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#68766d] md:text-sm">
            Give, receive, and connect — anonymously and with trust at the heart of every exchange.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TrustBadge level={myReputation?.level} trustScore={myReputation?.trust_score} />
          </div>
          <div className="mt-3">
            <RatingStars
              rating={myReputation?.average_rating || 0}
              reviewCount={myReputation?.review_count || 0}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button as="link" to="/browse" className="h-10 px-6 text-[12px] transition-shadow hover:shadow-md md:text-[13px]">
              Browse Items
            </Button>
            <Button as="link" to="/give" variant="secondary" className="h-10 px-6 text-[12px] md:text-[13px]">
              List Item
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

      {/* Messages / Feedback */}
      {(loadingRequests || requestsMessage || requestsError) ? (
        <div className="space-y-1.5 px-2">
          {loadingRequests ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#68766d]">Refreshing...</p> : null}
          {requestsMessage ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b4cf6]">{requestsMessage}</p> : null}
          {requestsError ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#c65d4a]">{requestsError}</p> : null}
        </div>
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
            {requestList.length === 0 ? (
              <EmptyState
                title="No active requests"
                description="When you request an item, it will appear here."
              />
            ) : (
              requestList.map((request) => {
                const reviewContext = getReviewContextForMyRequest?.(request)
                const convId = getChatConversationForRequest?.(request.id)
                return (
                  <RequestCard key={request.id} request={request}>
                    <div className="mt-2.5 flex flex-col gap-1.5 border-t border-[#fcfbf9] pt-2">
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
              })
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
            {incomingRequests.length === 0 ? (
              <EmptyState
                title="No pending reviews"
                description="Requests will appear here."
              />
            ) : (
              incomingRequests.slice(0, 5).map((request) => {
                const reviewContext = getReviewContextForOwnerRequest?.(request)
                const convId = getChatConversationForRequest?.(request.id)
                return (
                  <RequestCard key={request.id} request={request}>
                    {request.status === 'pending' ? (
                      <div className="mt-2.5 flex gap-1.5 border-t border-[#fcfbf9] pt-2">
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
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
