import ItemCard from '../components/ItemCard.jsx'
import { Button, EmptyState, SectionHeading, StatusBadge, Surface } from '../components/ui.jsx'

function countItemsByStatus(items, status) {
  return items.filter((item) => item.status === status).length
}

function RequestPreviewCard({ request, onRequestAction }) {
  return (
    <article className="rounded-card border border-[#efe8da] bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold text-[#1f1f1f]">{request.item_title}</h3>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/70">{request.requester_name.split(' ')[0]} is interested</p>
        </div>
        <div className="shrink-0 scale-90 origin-top-right">
          <StatusBadge status={request.status} />
        </div>
      </div>

      {request.status === 'pending' ? (
        <div className="mt-2.5 flex gap-1.5 border-t border-[#fcfbf9] pt-2">
          <Button className="flex-1 h-7 min-h-0 text-[10px] rounded-btn" onClick={() => onRequestAction(request.id, 'approve')}>Approve</Button>
          <Button className="flex-1 h-7 min-h-0 text-[10px] rounded-btn" variant="secondary" onClick={() => onRequestAction(request.id, 'reject')}>Decline</Button>
        </div>
      ) : null}
    </article>
  )
}

export default function GiverHomePage({
  currentUser,
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
  loadingRequests,
  requestsMessage,
  requestsError,
}) {
  const itemsSharedCount = myItems?.length || 0;
  const itemsRequestedCount = myRequests?.length || 0;
  const completedExchangesCount = myItems?.filter(item => item.status === 'completed').length || 0;
  const trustPoints = (itemsSharedCount * 10) + (completedExchangesCount * 50);

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
    <div className="space-y-6 md:space-y-8 md:max-w-5xl md:mx-auto md:px-4">
      {/* Welcome Card & Stats Section */}
      <section className="flex flex-col md:flex-row gap-4 md:gap-6">
        <div className="flex-1 flex flex-col justify-center bg-gradient-to-br from-[#8b4cf6]/10 to-[#ffcc22]/20 p-5 md:p-8 rounded-[24px] border border-[#efe8da]/80 shadow-xs">
          <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#8c755f]/80">Community Steward</p>
          <h1 className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-2xl md:text-3xl font-bold tracking-tight text-[#1f1f1f]">Welcome back, {currentUser.name.split(' ')[0]}</h1>
          <p className="mt-2 text-xs md:text-sm text-[#68766d] max-w-sm leading-relaxed">Your unused things can become someone&apos;s blessing. What will you share today?</p>
          <div className="mt-5">
             <Button as="link" to="/give" className="h-10 text-[12px] md:text-[13px] px-6 shadow-sm hover:shadow-md transition-shadow">List a New Item</Button>
          </div>
        </div>

        <div className="md:w-80 grid grid-cols-2 gap-3 md:gap-4 shrink-0">
          <div className="rounded-card border border-[#efe8da]/80 bg-white p-4 md:p-5 text-center flex flex-col justify-center shadow-xs">
            <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-[#8c755f]/70 mb-1">Items Shared</p>
            <p className="text-2xl md:text-3xl font-bold text-[#1f1f1f]">{itemsSharedCount}</p>
          </div>
          <div className="rounded-card border border-[#efe8da]/80 bg-white p-4 md:p-5 text-center flex flex-col justify-center shadow-xs">
            <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-[#8c755f]/70 mb-1">Requested</p>
            <p className="text-2xl md:text-3xl font-bold text-[#1f1f1f]">{itemsRequestedCount}</p>
          </div>
          <div className="rounded-card border border-[#efe8da]/80 bg-white p-4 md:p-5 text-center flex flex-col justify-center shadow-xs">
            <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-[#8c755f]/70 mb-1">Completed</p>
            <p className="text-2xl md:text-3xl font-bold text-[#1f1f1f]">{completedExchangesCount}</p>
          </div>
          <div className="rounded-card border border-[#efe8da]/80 bg-gradient-to-br from-[#8b4cf6] to-[#7340d2] p-4 md:p-5 text-center flex flex-col justify-center shadow-xs">
            <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">Trust Points</p>
            <p className="text-2xl md:text-3xl font-bold text-white">{trustPoints}</p>
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

      <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
         {/* Your Shared Items */}
         <div className="flex-1 space-y-4 md:space-y-5">
           <SectionHeading
             title="Your shared items"
             description="Manage your active listings."
           />

           {loadingMyItems ? <p className="text-[11px] text-[#68766d]">Updating listings...</p> : null}

           {!loadingMyItems && myItems.length === 0 ? (
             <EmptyState
               title={'You haven\'t listed anything yet 🌱'}
               description="Your first item can help someone nearby."
               action={<Button as="link" to="/give">List your first item</Button>}
             />
           ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-5">
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

         {/* Incoming Requests Sidebar */}
         <div className="lg:w-80 shrink-0 space-y-4 md:space-y-5">
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
               ownerRequests.slice(0, 5).map((request) => (
                 <RequestPreviewCard key={request.id} request={request} onRequestAction={onRequestAction} />
               ))
             )}
           </div>
         </div>
      </div>
    </div>
  )
}
