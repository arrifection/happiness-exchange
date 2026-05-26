import { Navigate, useParams } from 'react-router-dom'

import ItemCard from '../components/ItemCard.jsx'
import { Button, EmptyState, Surface } from '../components/ui.jsx'
import { storageConditionLabel } from '../lib/categories.js'

export default function ItemDetailsPage({
  currentUser,
  items,
  myItems,
  getMyRequestForItem,
  getReviewContextForItem,
  onCreateRequest,
  onOpenReview,
  onDeleteItem,
  onCompleteItem,
  ownerActionItemId,
}) {
  const { itemId } = useParams()
  const item = [...myItems, ...items].find((entry) => entry.id === itemId)

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (!item) {
    return (
      <EmptyState
        title="Item not found"
        description="This listing may have been removed or is no longer available."
        action={<Button as="link" to="/browse">Back to Browse</Button>}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Header and Back navigation */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-he-ink">
            Item Details
          </h1>
          <p className="text-[10px] text-he-muted">View the listing and make requests.</p>
        </div>
        <Button as="link" to="/browse" variant="ghost" className="h-7 min-h-0 px-2.5 text-[10px] text-[#8b4cf6] hover:bg-[#8b4cf6]/5">
          ← Back
        </Button>
      </div>

      {/* Main card */}
      <ItemCard
        item={item}
        currentUser={currentUser}
        myRequest={getMyRequestForItem(item.id)}
        reviewContext={getReviewContextForItem(item)}
        onCreateRequest={onCreateRequest}
        onOpenReview={onOpenReview}
        onDeleteItem={onDeleteItem}
        onCompleteItem={onCompleteItem}
        ownerActionPending={ownerActionItemId === item.id}
      />

      {/* Detail Block */}
      <Surface className="p-4.5">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-he-soft">Description & Pickup Details</h2>
        <p className="mt-2 text-xs leading-relaxed text-he-muted">{item.description}</p>
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-he-border/60 pt-3.5">
          <span className="rounded-full border border-he-border bg-he-surface-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-he-soft">
            {item.category}
          </span>
          <span className="rounded-full border border-he-border bg-he-surface-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-he-soft">
            {item.condition}
          </span>
          <span className="rounded-full border border-he-border bg-he-surface-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-he-soft">
            {item.location_display || item.location}
          </span>
          {item.category === 'Food' && (item.expiry_date || item.sealed_packaging != null || item.storage_condition) ? (
            <>
              {item.expiry_date ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                  Expires {item.expiry_date}
                </span>
              ) : null}
              {item.sealed_packaging ? (
                <span className="rounded-full border border-he-border bg-he-surface-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-he-soft">
                  Sealed
                </span>
              ) : null}
              {item.storage_condition ? (
                <span className="rounded-full border border-he-border bg-he-surface-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-he-soft">
                  {storageConditionLabel(item.storage_condition)}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      </Surface>
    </div>
  )
}
