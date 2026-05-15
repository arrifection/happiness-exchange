import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button, EmptyState, SectionHeading, StatusBadge, Surface } from '../components/ui.jsx'

function countItemsByStatus(items, status) {
  return items.filter((item) => item.status === status).length
}

function SidebarLink({ href, children }) {
  return (
    <a
      href={href}
      className="inline-flex items-center rounded-full border border-white/70 bg-white/74 px-4 py-2 text-sm font-semibold text-[#486159] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
    >
      {children}
    </a>
  )
}

function StatsCard({ label, value, tone = 'cream' }) {
  const tones = {
    cream: 'bg-[#fbf6ef]',
    green: 'bg-[#eef7f1]',
    blue: 'bg-[#edf5fb]',
    peach: 'bg-[#fff1e8]',
  }

  return (
    <div className={`rounded-[28px] ${tones[tone]} p-5 shadow-sm`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b6d60]">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-[#20352e]">{value}</p>
    </div>
  )
}

function RequestReviewCard({ request, onRequestAction }) {
  return (
    <article className="rounded-[28px] border border-[#f0e9de] bg-[#fffaf4] p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b56643]">Incoming request</p>
          <h3 className="mt-2 font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-xl font-semibold tracking-[-0.04em] text-[#223833]">
            {request.item_title}
          </h3>
          <p className="mt-2 text-sm text-[#62716c]">{request.requester_name} would like this item.</p>
        </div>
        <StatusBadge status={request.status} />
      </div>

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
    </article>
  )
}

function ListedItemCard({ item }) {
  const [imageAvailable, setImageAvailable] = useState(Boolean(item.image_url))

  return (
    <article className="group overflow-hidden rounded-[30px] border border-white/70 bg-white/84 shadow-[0_18px_50px_rgba(29,33,44,0.08)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(29,33,44,0.14)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(135deg,rgba(141,189,167,0.9),rgba(243,191,168,0.88))]">
        {item.image_url && imageAvailable ? (
          <>
            <img
              src={item.image_url}
              alt={item.title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              onError={() => setImageAvailable(false)}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_28%,rgba(32,53,46,0.52)_100%)]" />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center text-white">
            <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur">
              <div className="h-10 w-10 rounded-2xl border border-white/60 bg-white/82" />
            </div>
            <h3 className="mt-5 font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-xl font-semibold">
              Shared with care
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/84">
              Your unused things can reach someone nearby who truly needs them.
            </p>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <span className="rounded-full bg-white/82 px-3 py-1 text-xs font-semibold text-[#466359] shadow-sm">
            {item.category}
          </span>
          <StatusBadge status={item.status} className="bg-white/88 backdrop-blur" />
        </div>
      </div>

      <div className="space-y-4 p-6">
        <div>
          <h3 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-2xl font-semibold tracking-[-0.04em] text-[#20352e]">
            {item.title}
          </h3>
          <p className="mt-3 text-sm leading-7 text-[#64736e]">{item.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#f3efe7] px-3 py-1.5 text-xs font-medium text-[#4f615b]">
            {item.condition}
          </span>
          <span className="rounded-full bg-[#eef6f1] px-3 py-1.5 text-xs font-medium text-[#447261]">
            {item.location}
          </span>
          <span className="rounded-full bg-[#fff2ea] px-3 py-1.5 text-xs font-medium text-[#b06144]">
            {item.request_count ?? 0} requests
          </span>
        </div>
      </div>
    </article>
  )
}

export default function GiverHomePage({
  currentUser,
  myItems,
  myItemsError,
  loadingMyItems,
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
      <Surface className="p-8 text-center sm:p-12">
        <h2 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-3xl font-semibold tracking-[-0.04em] text-[#20352e]">
          Please log in first
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#66746f]">
          Your giver home appears after you sign in so your items and requests stay connected to your account.
        </p>
      </Surface>
    )
  }

  return (
    <div className="grid gap-6 pb-8 xl:grid-cols-[0.32fr_0.68fr]">
      <div className="space-y-6 xl:sticky xl:top-28 xl:self-start">
        <Surface className="overflow-hidden bg-[linear-gradient(180deg,#fff8f0,#f7eee3)] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b35d3c]">Giver space</p>
          <h2 className="mt-4 font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-3xl font-semibold tracking-[-0.05em] text-[#20352e]">
            Home for listing, tracking, and responding kindly
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#65736e]">
            Keep your shared items organized and see who needs them without losing the warm community feel.
          </p>

          <div className="mt-6 grid gap-3">
            <SidebarLink href="#lister-home">Home</SidebarLink>
            <Link
              to="/give"
              className="inline-flex items-center rounded-full border border-white/70 bg-white/74 px-4 py-2 text-sm font-semibold text-[#486159] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            >
              List Item
            </Link>
            <SidebarLink href="#lister-requests">Requests</SidebarLink>
            <SidebarLink href="#lister-settings">Settings</SidebarLink>
          </div>
        </Surface>

        {(loadingRequests || requestsMessage || requestsError || myItemsError) ? (
          <Surface className="p-6">
            <h3 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-xl font-semibold text-[#20352e]">
              Activity
            </h3>
            {loadingRequests ? <p className="mt-3 text-sm text-[#687670]">Refreshing request activity...</p> : null}
            {requestsMessage ? <p className="mt-3 text-sm font-medium text-[#1d6b57]">{requestsMessage}</p> : null}
            {requestsError ? <p className="mt-3 text-sm font-medium text-[#b04e43]">{requestsError}</p> : null}
            {myItemsError ? <p className="mt-3 text-sm font-medium text-[#b04e43]">{myItemsError}</p> : null}
          </Surface>
        ) : null}
      </div>

      <div className="space-y-6">
        <Surface id="lister-home" className="relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
          <div className="absolute right-[-2rem] top-[-2rem] h-40 w-40 rounded-full bg-[#f0b89c]/35 blur-3xl" />
          <div className="absolute bottom-[-4rem] left-12 h-44 w-44 rounded-full bg-[#9fc6b1]/25 blur-3xl" />

          <div className="relative">
            <p className="inline-flex rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b35d3c] shadow-sm">
              Welcome back, {currentUser.name}
            </p>
            <h1 className="mt-5 max-w-3xl text-balance font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-5xl font-semibold leading-[0.95] tracking-[-0.06em] text-[#20352e] sm:text-6xl">
              Your unused things can become someone&apos;s blessing.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#5f6d68] sm:text-lg">
              Keep listing with care, respond to requests with confidence, and make the giver experience feel generous from the first glance.
            </p>

            <div className="mt-8">
              <Button as="link" to="/give">
                List a new item
              </Button>
            </div>
          </div>
        </Surface>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Total listed items" value={myItems.length} tone="cream" />
          <StatsCard label="Available items" value={availableItems} tone="green" />
          <StatsCard label="Reserved items" value={reservedItems} tone="blue" />
          <StatsCard label="Requests received" value={ownerRequests.length} tone="peach" />
        </section>

        <Surface className="p-6 sm:p-8">
          <SectionHeading
            eyebrow="My listed items"
            title="Everything you&apos;ve shared, in one warmer home"
            description="Review your active listings, see their current status, and quickly understand how much interest each item is receiving."
            action={(
              <Button as="link" to="/give" variant="secondary">
                List a new item
              </Button>
            )}
          />

          {loadingMyItems ? <p className="mt-6 text-sm text-[#67756f]">Loading your items...</p> : null}

          {!loadingMyItems && myItems.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="You haven&apos;t listed anything yet 🌱"
                description="Your first listing can turn something sitting unused at home into help for someone nearby."
                action={(
                  <Button as="link" to="/give">
                    List your first item
                  </Button>
                )}
              />
            </div>
          ) : null}

          {!loadingMyItems && myItems.length > 0 ? (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {myItems.map((item) => (
                <ListedItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : null}
        </Surface>

        <Surface id="lister-requests" className="p-6 sm:p-8">
          <SectionHeading
            eyebrow="Requests"
            title="Incoming interest from the community"
            description="Approve or reject requests with the same backend logic you already had, now placed in a cleaner giver-focused section."
          />

          <div className="mt-6 grid gap-4">
            {ownerRequests.length === 0 ? (
              <EmptyState
                title="No requests yet"
                description="When someone is interested in one of your items, it will appear here for review."
              />
            ) : (
              ownerRequests.map((request) => (
                <RequestReviewCard
                  key={request.id}
                  request={request}
                  onRequestAction={onRequestAction}
                />
              ))
            )}
          </div>
        </Surface>

        <Surface id="lister-settings" className="relative overflow-hidden bg-[linear-gradient(135deg,#fff8f0,#f7f0e7)] p-6 sm:p-8">
          <div className="absolute right-8 top-8 h-24 w-24 rounded-full bg-[#f2c3ae]/40 blur-2xl" />
          <div className="absolute bottom-8 left-8 h-28 w-28 rounded-full bg-[#97bea8]/30 blur-2xl" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b35d3c]">Settings</p>
            <h2 className="mt-4 max-w-xl font-display text-5xl leading-none tracking-[-0.03em] text-[#2c3b35] sm:text-6xl">
              Account settings can arrive next, without rushing this step.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-[#62716c]">
              Step 2 keeps this area visible in the giver navigation, but leaves the actual settings logic untouched for now.
            </p>
          </div>
        </Surface>
      </div>
    </div>
  )
}
