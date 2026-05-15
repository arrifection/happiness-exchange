import { Button, EmptyState, SectionHeading, StatusBadge, Surface } from '../components/ui.jsx'

function RequestCard({ request, children }) {
  return (
    <article className="rounded-2xl border border-[#eadfce] bg-[#faf7f1]/30 p-3.5 transition-colors hover:bg-[#faf7f1]/50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold text-[#1f3328]">{request.item_title}</h3>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">
            {request.requester_name ? `Requester: ${request.requester_name.split(' ')[0]}` : 'Personal request'}
          </p>
        </div>
        <StatusBadge status={request.status} className="shrink-0" />
      </div>
      {children}
    </article>
  )
}

export default function DashboardPage({
  currentUser,
  myRequests,
  ownerRequests,
  onRequestAction,
  loadingRequests,
  requestsMessage,
  requestsError,
}) {
  if (!currentUser) {
    return (
      <Surface className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-[#1f3328]">Please log in</h1>
        <p className="mt-2 text-xs leading-relaxed text-[#68766d]">
          Your account dashboard appears after sign in.
        </p>
      </Surface>
    )
  }

  return (
    <div className="space-y-6">
      <Surface className="p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1f6f50]">Profile</p>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold tracking-tight text-[#1f3328]">{currentUser.name}</h1>
            <p className="text-xs text-[#68766d]">{currentUser.email}</p>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-col items-center rounded-2xl bg-[#f4efe7] px-4 py-2">
              <span className="text-xs font-bold text-[#1f3328]">{myRequests.length}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]">Requests</span>
            </div>
            <div className="flex flex-col items-center rounded-2xl bg-[#f4efe7] px-4 py-2">
              <span className="text-xs font-bold text-[#1f3328]">{ownerRequests.length}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]">To Review</span>
            </div>
          </div>
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
        <SectionHeading
          title="Items you requested"
          description="Your active requests for community items."
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {myRequests.length === 0 ? (
            <div className="sm:col-span-2">
              <EmptyState
                title="No active requests"
                description="When you request an item, it will appear here."
              />
            </div>
          ) : (
            myRequests.map((request) => <RequestCard key={request.id} request={request} />)
          )}
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading
          title="Review incoming requests"
          description="Approve or decline requests for your items."
          action={<Button as="link" to="/requests" variant="ghost" className="h-8 min-h-0 px-2 text-[10px]">Manage all</Button>}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ownerRequests.length === 0 ? (
            <div className="sm:col-span-2">
              <EmptyState
                title="No pending reviews"
                description="Incoming requests for your items will appear here."
              />
            </div>
          ) : (
            ownerRequests.slice(0, 4).map((request) => (
              <RequestCard key={request.id} request={request}>
                {request.status === 'pending' ? (
                  <div className="mt-4 flex gap-2">
                    <Button className="flex-1 h-8 min-h-0 text-[10px]" onClick={() => onRequestAction(request.id, 'approve')}>Approve</Button>
                    <Button className="flex-1 h-8 min-h-0 text-[10px]" variant="danger" onClick={() => onRequestAction(request.id, 'reject')}>Decline</Button>
                  </div>
                ) : null}
              </RequestCard>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
