import ItemCard from '../components/ItemCard.jsx'
import { Button, EmptyState, SectionHeading, Surface } from '../components/ui.jsx'

export default function BrowseItemsPage({
  items,
  currentUser,
  getMyRequestForItem,
  onCreateRequest,
  onRefreshItems,
  loadingItems,
  itemsError,
}) {
  return (
    <div className="space-y-8 pb-8">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Surface className="px-6 py-8 sm:px-8 sm:py-10">
          <SectionHeading
            eyebrow="Browse"
            title="Explore items the community is ready to pass on"
            description="Each listing keeps the essentials visible at a glance: category, location, condition, owner, and request status."
          />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" onClick={onRefreshItems}>
              Refresh listings
            </Button>
            <Button as="link" to="/give">
              Share something today
            </Button>
          </div>
        </Surface>

        <Surface className="grid gap-4 px-6 py-6 sm:px-8">
          <div className="rounded-[28px] bg-[#fbf6ef] p-5">
            <p className="text-sm font-medium text-[#5f6d68]">Available now</p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-[#20352e]">{items.length}</p>
          </div>
          <div className="rounded-[28px] bg-[#eff7f2] p-5">
            <p className="text-sm font-medium text-[#5f6d68]">Experience upgrade</p>
            <p className="mt-2 text-sm leading-7 text-[#66746f]">
              Listings now feel more like a premium community app and less like a generic classifieds page.
            </p>
          </div>
        </Surface>
      </section>

      {loadingItems ? <p className="text-sm text-[#67756f]">Loading items...</p> : null}
      {itemsError ? <p className="text-sm font-medium text-[#b04e43]">{itemsError}</p> : null}

      {!loadingItems && !itemsError && items.length === 0 ? (
        <EmptyState
          title="No items available yet"
          description="Once neighbors begin sharing, their listings will appear here in a cleaner card layout."
        />
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            currentUser={currentUser}
            myRequest={getMyRequestForItem(item.id)}
            onCreateRequest={onCreateRequest}
          />
        ))}
      </div>
    </div>
  )
}
