import { useEffect, useState } from 'react'
import ItemCard from '../components/ItemCard.jsx'
import { Button, EmptyState, SectionHeading, Surface } from '../components/ui.jsx'

const TAGLINES = [
  "Give what you can. Find what you need.",
  "Share with kindness. Receive with dignity.",
  "Your extra can become someone’s blessing.",
  "A quiet way to help your community."
]

function HowItWorksStep({ number, title, description, isActive }) {
  return (
    <div className={`flex flex-col gap-1 rounded-card border p-3.5 md:p-5 transition-all duration-700 ease-in-out ${
      isActive 
        ? 'bg-white border-[#8b4cf6]/40 shadow-[0_0_16px_rgba(139,76,246,0.12),0_0_12px_rgba(255,204,34,0.08)] scale-[1.02] md:scale-105 z-10' 
        : 'bg-[#faf7f1] border-[#efe8da]/60 scale-100 shadow-none z-0'
    }`}>
      <div className={`flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full text-[10px] md:text-[13px] font-bold transition-colors duration-700 ${
        isActive
          ? 'bg-[#8b4cf6] text-white shadow-sm'
          : 'bg-[#8b4cf6]/10 text-[#8b4cf6]'
      }`}>
        {number}
      </div>
      <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[12px] md:text-[15px] font-bold text-[#1f1f1f]">{title}</h3>
      <p className="text-[10px] md:text-[12px] leading-relaxed text-[#68766d]">{description}</p>
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
  const [taglineIndex, setTaglineIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex(i => (i + 1) % TAGLINES.length)
    }, 5500)
    
    const stepInterval = setInterval(() => {
      setStepIndex(i => (i + 1) % 3)
    }, 2500)
    
    return () => {
      clearInterval(interval)
      clearInterval(stepInterval)
    }
  }, [])

  const recentItems = items.slice(0, 4) // Display 4 items for 2-column balanced grid

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Hero Section */}
      <Surface className="overflow-hidden p-0">
        <div className="bg-gradient-to-br from-[#8b4cf6]/5 via-[#ffcc22]/2 to-transparent p-5 md:p-8 md:py-12 md:flex md:flex-col md:items-center md:text-center">
          <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.15em] text-[#8c755f]">
            {currentUser ? `Welcome back, ${currentUser.name.split(' ')[0]}` : 'Welcome Home'}
          </p>
          
          <div className="mt-3 relative h-16 md:h-20 w-full max-w-2xl mx-auto flex items-center justify-center">
            {TAGLINES.map((tagline, i) => (
              <h1
                key={tagline}
                className={`absolute w-full flex items-center justify-center font-['Plus_Jakarta_Sans',sans-serif] text-2xl md:text-3xl lg:text-[32px] font-bold tracking-tight text-[#1f1f1f] leading-snug transition-all duration-[1200ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${
                  i === taglineIndex
                    ? 'opacity-100 translate-y-0 scale-100'
                    : 'opacity-0 translate-y-3 scale-[0.98]'
                }`}
              >
                {tagline}
              </h1>
            ))}
          </div>

          <div className="mt-6 md:mt-8 flex flex-col sm:flex-row gap-4 w-full md:max-w-[400px] md:justify-center mx-auto">
            <Button as="link" to="/browse" className="flex-1 min-h-12 text-[13px] md:text-[15px] font-bold py-3 px-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(139,76,246,0.2)]">
              Browse Items
            </Button>
            <Button as="link" to="/give" variant="secondary" className="flex-1 min-h-12 text-[13px] md:text-[15px] font-bold py-3 px-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(255,204,34,0.15)] hover:border-[#ffcc22]/40 bg-white">
              Give Item
            </Button>
          </div>
        </div>

        {/* Stats bar - subtle */}
        <div className="flex items-center gap-5 border-t border-[#efe8da] bg-[#faf7f1]/40 px-5 py-3 md:px-8">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/70">Listings</p>
            <p className="text-xs font-bold text-[#1f1f1f]">{items.length}</p>
          </div>
          <div className="h-3 w-px bg-[#efe8da]" />
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/70">My requests</p>
            <p className="text-xs font-bold text-[#1f1f1f]">{myRequests.length}</p>
          </div>
          {ownerRequests.length > 0 && (
            <>
              <div className="h-3 w-px bg-[#efe8da]" />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/70">To Review</p>
                <p className="text-xs font-bold text-[#8b4cf6]">{ownerRequests.length}</p>
              </div>
            </>
          )}
        </div>
      </Surface>

      {/* How it works row */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <HowItWorksStep
          number="1"
          title="List"
          description="Share your items with neighbors."
          isActive={stepIndex === 0}
        />
        <HowItWorksStep
          number="2"
          title="Request"
          description="Tap to show your interest."
          isActive={stepIndex === 1}
        />
        <HowItWorksStep
          number="3"
          title="Share"
          description="Coordinate a quick pickup."
          isActive={stepIndex === 2}
        />
      </div>

      {/* Recent items */}
      <div className="space-y-3 md:space-y-4">
        <SectionHeading
          title="Recently Shared"
          description="Items just added by neighbors."
          action={<Button as="link" to="/browse" variant="ghost" className="h-7 min-h-0 px-2 text-[9px]">See all</Button>}
        />

        {loadingItems ? <p className="text-[11px] text-[#68766d]">Loading listings...</p> : null}
        {itemsError ? <p className="text-[11px] font-medium text-[#c65d4a]">{itemsError}</p> : null}

        {!loadingItems && !itemsError && recentItems.length === 0 ? (
          <EmptyState
            title="No items yet"
            description="Be the first to share something with the community."
            action={<Button as="link" to="/give">Give Item</Button>}
          />
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-6">
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
