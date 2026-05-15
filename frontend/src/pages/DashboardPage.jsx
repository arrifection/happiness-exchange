import { Button, EmptyState, SectionHeading, StatusBadge, Surface } from '../components/ui.jsx'

function RequestCard({ request, children }) {
  return (
    <article className="rounded-[28px] border border-[#f1eadf] bg-[#fffaf4] p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-xl font-semibold tracking-[-0.04em] text-[#243a33]">
            {request.item_title}
          </h3>
          {request.requester_name ? (
            <p className="mt-2 text-sm text-[#62716c]">Requester: {request.requester_name}</p>
          ) : (
            <p className="mt-2 text-sm text-[#62716c]">Requested by you</p>
          )}
        </div>
        <StatusBadge status={request.status} />
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
  return (
    <div className="space-y-8 pb-8">
      <SectionHeading
        eyebrow="Dashboard"
        title="A clearer home for your account, requests, and approvals"
        description="The layout is polished, easier to scan, and still powered by the same existing request flows."
      />

      {!currentUser ? (
        <Surface className="p-8 text-center sm:p-12">
          <h2 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-3xl font-semibold tracking-[-0.04em] text-[#20352e]">
            Please log in first
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#66746f]">
            Your dashboard appears after you sign in so requests and shared items stay personal to your account.
          </p>
        </Surface>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <div className="space-y-6">
            <Surface className="p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b35d3c]">Your profile</p>
              <div className="mt-5 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[linear-gradient(135deg,#1d6b57,#93bea7)] text-xl font-semibold text-white shadow-[0_16px_36px_rgba(29,107,87,0.24)]">
                  {currentUser.name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-2xl font-semibold tracking-[-0.04em] text-[#20352e]">
                    {currentUser.name}
                  </h2>
                  <p className="mt-1 text-sm text-[#64736e]">{currentUser.email}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-3">
                <div className="rounded-[24px] bg-[#fbf6ef] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8e6f58]">My requests</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#20352e]">{myRequests.length}</p>
                </div>
                <div className="rounded-[24px] bg-[#eef7f1] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#5f7f72]">Requests to review</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#20352e]">{ownerRequests.length}</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-7 text-[#66746f]">
                Your session token is still stored locally, just as before. Only the presentation has changed.
              </p>
            </Surface>

            {(loadingRequests || requestsMessage || requestsError) ? (
              <Surface className="p-6">
                <h2 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-xl font-semibold text-[#20352e]">
                  Activity
                </h2>
                {loadingRequests ? <p className="mt-3 text-sm text-[#687670]">Refreshing request activity...</p> : null}
                {requestsMessage ? <p className="mt-3 text-sm font-medium text-[#1d6b57]">{requestsMessage}</p> : null}
                {requestsError ? <p className="mt-3 text-sm font-medium text-[#b04e43]">{requestsError}</p> : null}
              </Surface>
            ) : null}
          </div>

          <div className="grid gap-6">
            <Surface className="p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-2xl font-semibold tracking-[-0.04em] text-[#20352e]">
                    My Requests
                  </h2>
                  <p className="mt-2 text-sm text-[#66746f]">Everything you&apos;ve asked to receive, with clearer status visibility.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {myRequests.length === 0 ? (
                  <EmptyState
                    title="No requests yet"
                    description="When you express interest in a listing, it will appear here with its current status."
                  />
                ) : (
                  myRequests.map((request) => (
                    <RequestCard key={request.id} request={request} />
                  ))
                )}
              </div>
            </Surface>

            <Surface className="p-6 sm:p-8">
              <div>
                <h2 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-2xl font-semibold tracking-[-0.04em] text-[#20352e]">
                  Requests For My Items
                </h2>
                <p className="mt-2 text-sm text-[#66746f]">
                  Approve or reject interest from other members without changing the backend behavior.
                </p>
              </div>

              <div className="mt-6 grid gap-4">
                {ownerRequests.length === 0 ? (
                  <EmptyState
                    title="No requests yet"
                    description="When someone is interested in one of your items, you will see it here with action buttons."
                  />
                ) : (
                  ownerRequests.map((request) => (
                    <RequestCard key={request.id} request={request}>
                      {request.status === 'pending' ? (
                        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                          <Button onClick={() => onRequestAction(request.id, 'approve')}>
                            Approve
                          </Button>
                          <Button variant="danger" onClick={() => onRequestAction(request.id, 'reject')}>
                            Reject
                          </Button>
                        </div>
                      ) : null}
                    </RequestCard>
                  ))
                )}
              </div>
            </Surface>
          </div>
        </div>
      )}
    </div>
  )
}
