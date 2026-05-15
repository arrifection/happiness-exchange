import { Link } from 'react-router-dom'

import ItemCard from '../components/ItemCard.jsx'
import { Button, EmptyState, SectionHeading, Surface } from '../components/ui.jsx'

const howItWorks = [
  {
    title: 'Share what still has value',
    description: 'Create a warm, honest listing with a few thoughtful details so the right person can find it quickly.',
  },
  {
    title: 'Receive respectful interest',
    description: 'Community members can request items without noise, bargaining, or marketplace-style clutter.',
  },
  {
    title: 'Choose a new home kindly',
    description: 'Approve one request, reserve the item, and keep the exchange clear for everyone involved.',
  },
]

const kindnessNotes = [
  'Fewer useful things end up forgotten or wasted.',
  'Neighbors get help without awkward transactions.',
  'Each listing turns extra space at home into shared value.',
]

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
  const featuredItems = items.slice(0, 3)
  const stats = [
    { label: 'Listings shared', value: items.length },
    { label: 'Kind requests sent', value: myRequests.length },
    { label: 'Owner reviews pending', value: ownerRequests.length },
  ]

  return (
    <div className="space-y-10 pb-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Surface className="relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="absolute right-[-2rem] top-[-2rem] h-40 w-40 rounded-full bg-[#f0b89c]/35 blur-3xl" />
          <div className="absolute bottom-[-4rem] left-12 h-44 w-44 rounded-full bg-[#9fc6b1]/25 blur-3xl" />

          <div className="relative max-w-3xl">
            <p className="inline-flex rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b35d3c] shadow-sm">
              Community giving, elevated
            </p>
            <h1 className="mt-5 max-w-3xl text-balance font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-5xl font-semibold leading-[0.95] tracking-[-0.06em] text-[#20352e] sm:text-6xl">
              Make generosity feel beautiful, local, and easy to trust.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#5f6d68] sm:text-lg">
              Happiness Exchange helps people pass along useful items for free with calm listings,
              thoughtful requests, and a community experience that feels warm from the first click.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button as="link" to="/browse">
                Browse Items
              </Button>
              <Button as="link" to="/give" variant="secondary">
                Give an Item
              </Button>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[24px] border border-white/75 bg-white/72 p-5 shadow-[0_18px_40px_rgba(35,39,46,0.07)] backdrop-blur"
                >
                  <p className="text-3xl font-semibold tracking-[-0.05em] text-[#20352e]">{stat.value}</p>
                  <p className="mt-2 text-sm text-[#62716c]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </Surface>

        <div className="grid gap-6">
          <Surface className="relative overflow-hidden bg-[linear-gradient(135deg,#1e6b57,#8ebca3)] px-6 py-7 text-white sm:px-8">
            <div className="absolute -right-6 top-8 h-32 w-32 rounded-full bg-white/12 blur-2xl" />
            <div className="absolute bottom-0 left-6 h-24 w-24 rounded-full bg-[#ffe7d8]/16 blur-2xl" />
            <div className="relative">
              <p className="inline-flex rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                Shared with care
              </p>
              <h2 className="mt-4 max-w-sm font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-3xl font-semibold tracking-[-0.04em]">
                Every item here starts as an act of kindness.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-7 text-white/82">
                No pricing games, no pressure, and no clutter. Just useful things finding new homes nearby.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] bg-white/12 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/70">Warm community</p>
                  <p className="mt-2 text-sm text-white/88">Neighbors helping neighbors with practical generosity.</p>
                </div>
                <div className="rounded-[24px] bg-white/12 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/70">Simple trust</p>
                  <p className="mt-2 text-sm text-white/88">Clear statuses and thoughtful requests reduce friction.</p>
                </div>
              </div>
            </div>
          </Surface>

          <Surface className="grid gap-4 px-6 py-6 sm:px-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b35d3c]">A calmer exchange</p>
                <h3 className="mt-2 font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-2xl font-semibold tracking-[-0.04em] text-[#20352e]">
                  Social proof that feels human
                </h3>
              </div>
              <div className="flex -space-x-2">
                {['A', 'K', 'S'].map((label, index) => (
                  <div
                    key={label}
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-white text-sm font-semibold text-white ${
                      index === 0 ? 'bg-[#1d6b57]' : index === 1 ? 'bg-[#d86d4f]' : 'bg-[#8bb89f]'
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <p className="rounded-[24px] bg-[#fbf6ef] p-4 text-sm leading-7 text-[#61706b]">
              “It feels less like a listings site and more like a kind local network.”
            </p>
          </Surface>
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="How it works"
          title="A warm, low-friction flow from listing to pickup"
          description="The experience stays intentionally simple so giving feels uplifting instead of transactional."
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {howItWorks.map((step, index) => (
            <Surface key={step.title} className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f2c7b2,#f8eadf)] text-sm font-semibold text-[#9d583e] shadow-sm">
                0{index + 1}
              </div>
              <h3 className="mt-5 font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-2xl font-semibold tracking-[-0.04em] text-[#223833]">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#66746f]">{step.description}</p>
            </Surface>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Featured items"
          title="Beautiful cards for items currently being shared"
          description="Large visuals, clear status badges, and cleaner hierarchy make each listing feel trustworthy and worth exploring."
          action={(
            <Button as="link" to="/browse" variant="secondary">
              Browse all items
            </Button>
          )}
        />

        {loadingItems ? <p className="text-sm text-[#67756f]">Loading items...</p> : null}
        {itemsError ? <p className="text-sm font-medium text-[#b04e43]">{itemsError}</p> : null}

        {!loadingItems && !itemsError && featuredItems.length === 0 ? (
          <EmptyState
            title="No featured items yet"
            description="The first community listing will appear here and set a thoughtful tone for the whole exchange."
          />
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          {featuredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              currentUser={currentUser}
              myRequest={getMyRequestForItem(item.id)}
              onCreateRequest={onCreateRequest}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Surface className="p-6 sm:p-8">
          <SectionHeading
            eyebrow="Community impact"
            title="Meaningful stats, not dashboard noise"
            description="The homepage now highlights warmth and momentum instead of looking like a generic template."
            align="start"
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[28px] bg-[#fbf6ef] p-5">
              <p className="text-3xl font-semibold tracking-[-0.05em] text-[#20352e]">{items.length}</p>
              <p className="mt-2 text-sm text-[#64736e]">Items available for the next act of generosity</p>
            </div>
            <div className="rounded-[28px] bg-[#eff7f2] p-5">
              <p className="text-3xl font-semibold tracking-[-0.05em] text-[#20352e]">{myRequests.length + ownerRequests.length}</p>
              <p className="mt-2 text-sm text-[#64736e]">Live connections happening across the community</p>
            </div>
          </div>
        </Surface>

        <Surface className="relative overflow-hidden bg-[linear-gradient(135deg,#fff8f0,#f7f0e7)] p-6 sm:p-8">
          <div className="absolute right-8 top-8 h-24 w-24 rounded-full bg-[#f2c3ae]/40 blur-2xl" />
          <div className="absolute bottom-8 left-8 h-28 w-28 rounded-full bg-[#97bea8]/30 blur-2xl" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b35d3c]">Kindness section</p>
            <h2 className="mt-4 max-w-xl font-display text-5xl leading-none tracking-[-0.03em] text-[#2c3b35] sm:text-6xl">
              Small acts make a neighborhood feel lighter.
            </h2>
            <div className="mt-6 grid gap-3">
              {kindnessNotes.map((note) => (
                <div key={note} className="flex items-start gap-3 rounded-[24px] bg-white/72 p-4 shadow-sm backdrop-blur">
                  <div className="mt-1 h-3 w-3 rounded-full bg-[#1d6b57]" />
                  <p className="text-sm leading-7 text-[#5f6d68]">{note}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Link className="text-sm font-semibold text-[#1d6b57] transition hover:text-[#155441]" to={currentUser ? '/give' : '/signup'}>
                {currentUser ? 'Create your next listing' : 'Join the exchange'}
              </Link>
            </div>
          </div>
        </Surface>
      </section>
    </div>
  )
}
