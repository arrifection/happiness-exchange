import ItemCard from '../components/ItemCard.jsx'
import { Button, EmptyState, SectionHeading, StatusBadge, Surface } from '../components/ui.jsx'

function countItemsByStatus(items, status) {
  return items.filter((item) => item.status === status).length
}

function RequestPreviewCard({ request, onRequestAction }) {
  return (
    <article className="rounded-2xl border border-[#eadfce] bg-[#faf7f1]/30 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold text-[#1f3328]">{request.item_title}</h3>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">{request.requester_name.split(' ')[0]} is interested</p>
        </div>
        <StatusBadge status={request.status} className="shrink-0" />
      </div>

      {request.status === 'pending' ? (
        <div className="mt-4 flex gap-2">
          <Button className="flex-1 h-8 min-h-0 text-[10px]" onClick={() => onRequestAction(request.id, 'approve')}>Approve</Button>
          <Button className="flex-1 h-8 min-h-0 text-[10px]" variant="danger" onClick={() => onRequestAction(request.id, 'reject')}>Decline</Button>
        </div>
      ) : null}
    </article>
  )
}

export default function GiverHomePage({
  currentUser,
  myItems,
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
  const availableItems = countItemsByStatus(myItems, 'available')
  const reservedItems = countItemsByStatus(myItems, 'reserved')

  if (!currentUser) {
    return (
      <Surface className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-[#1f3328]">Please log in</h1>
        <p className="mt-2 text-xs leading-relaxed text-[#68766d]">
          Your giver dashboard appears after sign in.
        </p>
      </Surface>
    )
  }

  return (
    <div className="space-y-6">
      <Surface className="p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1f6f50]">Community Steward</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold tracking-tight text-[#1f3328]">Welcome, {currentUser.name.split(' ')[0]}</h1>
            <p className="text-xs text-[#68766d]">Your unused things can become someone&apos;s blessing.</p>
          </div>
          <Button as="link" to="/give" className="sm:min-w-[140px]">List an Item</Button>
        </div>
      </Surface>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Total Listed', myItems.length],
          ['Available', availableItems],
          ['Reserved', reservedItems],
          ['Requests', ownerRequests.length],
        ].map(([label, value]) => (
          <Surface key={label} className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">{label}</p>
            <p className="mt-1 text-lg font-bold text-[#1f3328]">{value}</p>
          </Surface>
        ))}
      </div>

      {(loadingRequests || requestsMessage || requestsError || myItemsError) ? (
        <div className="space-y-2">
          {loadingRequests ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#68766d]">Refreshing...</p> : null}
          {requestsMessage ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#1f6f50]">{requestsMessage}</p> : null}
          {requestsError ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#c65d4a]">{requestsError}</p> : null}
          {myItemsError ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#c65d4a]">{myItemsError}</p> : null}
        </div>
      ) : null}

      {(ownerItemsMessage || ownerItemsError) ? (
        <div className="space-y-2">
          {ownerItemsMessage ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#1f6f50]">{ownerItemsMessage}</p> : null}
          {ownerItemsError ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#c65d4a]">{ownerItemsError}</p> : null}
        </div>
      ) : null}

      <div className="space-y-4">
        <SectionHeading
          title="Your shared items"
          description="A compact view of everything you listed."
        />

        {loadingMyItems ? <p className="text-xs text-[#68766d]">Updating listings...</p> : null}

        {!loadingMyItems && myItems.length === 0 ? (
          <EmptyState
            title={'You haven\'t listed anything yet 🌱'}
            description="Your first item can help someone nearby."
            action={<Button as="link" to="/give">List your first item</Button>}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </div>

      <div className="space-y-4">
        <SectionHeading
          title="Incoming requests"
          description="Neighbors waiting for your approval."
          action={<Button as="link" to="/requests" variant="ghost" className="h-8 min-h-0 px-2 text-[10px]">Manage all</Button>}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ownerRequests.length === 0 ? (
            <div className="sm:col-span-2">
              <EmptyState
                title="No active requests"
                description="Incoming requests for your items will appear here."
              />
            </div>
          ) : (
            ownerRequests.slice(0, 4).map((request) => (
              <RequestPreviewCard key={request.id} request={request} onRequestAction={onRequestAction} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
