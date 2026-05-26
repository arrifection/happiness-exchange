import ItemCard from '../components/ItemCard.jsx'
import { RatingStars, ReputationBadge } from '../components/reputation.jsx'
import TrustBadge from '../components/TrustBadge.jsx'
import { Button, EmptyState, SectionHeading, StatusBadge, Surface } from '../components/ui.jsx'

function RequestPreviewCard({ request, onRequestAction, children }) {
  return (
    <article className="rounded-card border border-[#efe8da] bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold text-[#1f1f1f]">{request.item_title}</h3>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/70">
            {request.requester_name.split(' ')[0]} is interested
          </p>
        </div>
        <div className="origin-top-right shrink-0 scale-90">
          <StatusBadge status={request.status} />
        </div>
      </div>

      {request.status === 'pending' ? (
        <div className="mt-2.5 flex gap-1.5 border-t border-[#fcfbf9] pt-2">
          <Button className="h-7 min-h-0 flex-1 rounded-btn text-[10px]" onClick={() => onRequestAction(request.id, 'approve')}>Approve</Button>
          <Button className="h-7 min-h-0 flex-1 rounded-btn text-[10px]" variant="secondary" onClick={() => onRequestAction(request.id, 'reject')}>Decline</Button>
        </div>
      ) : null}

      {children}
    </article>
  )
}

export default function GiverHomePage({
  currentUser,
  myReputation,
  myItems,
  myRequests,
  myItemsError,
  loadingMyItems,
  ownerItemsMessage,
  ownerItemsError,
  ownerActionItemId,
  onDeleteItem,
  onCompleteItem,
  ownerRequests,
  onRequestAction,
  onOpenReview,
  getReviewContextForOwnerRequest,
  loadingRequests,
  requestsMessage,
  requestsError,
}) {
  const itemsSharedCount = myItems?.length || 0
  const itemsRequestedCount = myRequests?.length || 0
  const completedExchangesCount = myReputation?.completed_exchange_count || 0
  const trustPoints = myReputation?.trust_score || 0

  if (!currentUser) {
    return (
      <Surface className="p-5">
        <h1 className="text-lg font-bold tracking-tight text-[#1f1f1f]">Please log in</h1>
        <p className="mt-2 text-xs leading-relaxed text-[#68766d]">
          Your giver dashboard appears after sign in.
        </p>
      </Surface>
    )
  }

  return (
    <div className="space-y-6 md:mx-auto md:max-w-5xl md:space-y-8 md:px-4">
      <section className="flex flex-col gap-4 md:flex-row md:gap-6">
        <div className="flex flex-1 flex-col justify-center rounded-[24px] border border-[#efe8da]/80 bg-gradient-to-br from-[#8b4cf6]/10 to-[#ffcc22]/20 p-5 shadow-xs md:p-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/80 md:text-xs">Community Steward</p>
          <h1 className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold tracking-tight text-[#1f1f1f] md:text-3xl">
            Welcome back, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#68766d] md:text-sm">
            Your unused things can become someone else&apos;s blessing. What will you share today?
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TrustBadge
              level={myReputation?.level}
              trustScore={myReputation?.trust_score}
              nextLevelPoints={myReputation?.next_level_points}
            />
          </div>
          <div className="mt-3">
            <RatingStars
              rating={myReputation?.average_rating || 0}
              reviewCount={myReputation?.review_count || 0}
            />
          </div>
          <div className="mt-5">
            <Button as="link" to="/give" className="h-10 px-6 text-[12px] transition-shadow hover:shadow-md md:text-[13px]">
              List a New Item
            </Button>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 md:w-80 md:gap-4">
          <div className="flex flex-col justify-center rounded-card border border-[#efe8da]/80 bg-white p-4 text-center shadow-xs md:p-5">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#8c755f]/70 md:text-[10px]">Items Shared</p>
            <p className="text-2xl font-bold text-[#1f1f1f] md:text-3xl">{itemsSharedCount}</p>
          </div>
          <div className="flex flex-col justify-center rounded-card border border-[#efe8da]/80 bg-white p-4 text-center shadow-xs md:p-5">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#8c755f]/70 md:text-[10px]">Requested</p>
            <p className="text-2xl font-bold text-[#1f1f1f] md:text-3xl">{itemsRequestedCount}</p>
          </div>
          <div className="flex flex-col justify-center rounded-card border border-[#efe8da]/80 bg-white p-4 text-center shadow-xs md:p-5">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#8c755f]/70 md:text-[10px]">Completed</p>
            <p className="text-2xl font-bold text-[#1f1f1f] md:text-3xl">{completedExchangesCount}</p>
          </div>
          <div className="flex flex-col justify-center rounded-card border border-[#efe8da]/80 bg-gradient-to-br from-[#8b4cf6] to-[#7340d2] p-4 text-center shadow-xs md:p-5">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/80 md:text-[10px]">Trust Points</p>
            <p className="text-2xl font-bold text-white md:text-3xl">{trustPoints}</p>
          </div>
        </div>
      </section>

      {(loadingRequests || requestsMessage || requestsError || myItemsError || ownerItemsMessage || ownerItemsError) ? (
        <div className="space-y-1.5 px-2">
          {loadingRequests ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#68766d]">Refreshing...</p> : null}
          {requestsMessage ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b4cf6]">{requestsMessage}</p> : null}
          {requestsError ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#c65d4a]">{requestsError}</p> : null}
          {myItemsError ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#c65d4a]">{myItemsError}</p> : null}
          {ownerItemsMessage ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b4cf6]">{ownerItemsMessage}</p> : null}
          {ownerItemsError ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#c65d4a]">{ownerItemsError}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 md:gap-8 lg:flex-row">
        <div className="flex-1 space-y-4 md:space-y-5">
          <SectionHeading
            title="Your shared items"
            description="Manage your active listings."
          />

          {loadingMyItems ? <p className="text-[11px] text-[#68766d]">Updating listings...</p> : null}

          {!loadingMyItems && myItems.length === 0 ? (
            <EmptyState
              title="You haven't listed anything yet"
              description="Your first item can help someone nearby."
              action={<Button as="link" to="/give">List your first item</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:gap-5 sm:grid-cols-2">
              {myItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  currentUser={currentUser}
                  onDeleteItem={onDeleteItem}
                  onCompleteItem={onCompleteItem}
                  ownerActionPending={ownerActionItemId === item.id}
                  compact
                />
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-4 md:space-y-5 lg:w-80">
          <SectionHeading
            title="Incoming requests"
            description="Neighbors waiting for you."
            action={<Button as="link" to="/requests" variant="ghost" className="h-8 min-h-0 px-3 text-[10px]">View all</Button>}
          />

          <div className="flex flex-col gap-3">
            {ownerRequests.length === 0 ? (
              <EmptyState
                title="No active requests"
                description="Requests will appear here."
              />
            ) : (
              ownerRequests.slice(0, 5).map((request) => {
                const reviewContext = getReviewContextForOwnerRequest(request)
                return (
                  <RequestPreviewCard
                    key={request.id}
                    request={request}
                    onRequestAction={onRequestAction}
                  >
                    {reviewContext ? (
                      <div className="mt-2.5 flex gap-1.5 border-t border-[#fcfbf9] pt-2">
                        <Button
                          className="h-7 min-h-0 flex-1 rounded-btn text-[10px]"
                          variant="secondary"
                          onClick={() => onOpenReview(reviewContext)}
                        >
                          Leave Review
                        </Button>
                      </div>
                    ) : null}
                  </RequestPreviewCard>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
