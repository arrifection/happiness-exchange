import ItemCard from '../components/ItemCard.jsx'
import { Button, EmptyState, SectionHeading, Surface } from '../components/ui.jsx'

function HowItWorksStep({ number, title, description }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-[#f4efe7]/50 p-4">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1f6f50] text-[10px] font-bold text-white">
        {number}
      </div>
      <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold text-[#1f3328]">{title}</h3>
      <p className="text-[11px] leading-relaxed text-[#68766d]">{description}</p>
    </div>
  )
}

export default function HomePage({
  items,
  currentUser,
  getMyRequestForItem,
  onCreateRequest,
  loadingItems,
  itemsError,
  myRequests,
  ownerRequests,
}) {
  const recentItems = items.slice(0, 4)

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Surface className="overflow-hidden p-0">
        <div className="bg-gradient-to-br from-[#1f6f50]/5 to-transparent p-6 sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1f6f50]">
            {currentUser ? `Welcome back, ${currentUser.name.split(' ')[0]}` : 'Welcome Home'}
          </p>
          <h1 className="mt-3 font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-bold tracking-tight text-[#1f3328] sm:text-4xl">
            Give what you can.<br />
            Find what you need.
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#68766d]">
            A gentle community space for sharing useful things for free. Simple, local, and kind.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button as="link" to="/browse" className="min-w-[140px]">Browse Items</Button>
            <Button as="link" to="/give" variant="secondary" className="min-w-[140px]">Give an Item</Button>
          </div>
        </div>

        {/* Stats bar - subtle */}
        <div className="flex items-center gap-6 border-t border-[#eadfce] bg-[#faf7f1]/50 px-6 py-4 sm:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Listings</p>
            <p className="text-sm font-bold text-[#1f3328]">{items.length}</p>
          </div>
          <div className="h-4 w-px bg-[#eadfce]" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">My requests</p>
            <p className="text-sm font-bold text-[#1f3328]">{myRequests.length}</p>
          </div>
          {ownerRequests.length > 0 && (
            <>
              <div className="h-4 w-px bg-[#eadfce]" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">To Review</p>
                <p className="text-sm font-bold text-[#1f3328]">{ownerRequests.length}</p>
              </div>
            </>
          )}
        </div>
      </Surface>

      {/* How it works row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <HowItWorksStep
          number="1"
          title="List"
          description="Snap a photo and share your items with the neighbors."
        />
        <HowItWorksStep
          number="2"
          title="Request"
          description="See something useful? Just tap to show your interest."
        />
        <HowItWorksStep
          number="3"
          title="Share"
          description="Coordinate a pickup and pass on the happiness."
        />
      </div>

      {/* Recent items */}
      <div className="space-y-4">
        <SectionHeading
          title="Recently Shared"
          description="Items just added by your neighbors."
          action={<Button as="link" to="/browse" variant="ghost" className="h-8 min-h-0 px-2 text-[10px]">See all</Button>}
        />

        {loadingItems ? <p className="text-xs text-[#68766d]">Loading listings...</p> : null}
        {itemsError ? <p className="text-xs font-medium text-[#c65d4a]">{itemsError}</p> : null}

        {!loadingItems && !itemsError && recentItems.length === 0 ? (
          <EmptyState
            title="No items yet"
            description="Be the first to share something with the community."
            action={<Button as="link" to="/give">Give Item</Button>}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {recentItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              currentUser={currentUser}
              myRequest={getMyRequestForItem(item.id)}
              onCreateRequest={onCreateRequest}
              compact
            />
          ))}
        </div>
      </div>
    </div>
  )
}
