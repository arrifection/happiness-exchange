import { Navigate, useParams } from 'react-router-dom'

import ItemCard from '../components/ItemCard.jsx'
import { Button, EmptyState, ErrorState, ItemCardSkeleton, Surface } from '../components/ui.jsx'
import { storageConditionLabel } from '../lib/categories.js'
import { safeString } from '../lib/safeValues.js'

export default function ItemDetailsPage({
  currentUser,
  items,
  myItems,
  loadingItems = false,
  itemsError = '',
  onRefreshItems,
  getMyRequestForItem,
  getReviewContextForItem,
  onCreateRequest,
  onOpenReview,
  onDeleteItem,
  onCompleteItem,
  ownerActionItemId,
}) {
  const { itemId } = useParams()
  const item = [...(myItems || []), ...(items || [])].find((entry) => entry.id === itemId)

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (loadingItems && !item) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-he-ink">
            Item Details
          </h1>
          <p className="text-[10px] text-he-muted">Loading listing…</p>
        </div>
        <ItemCardSkeleton />
      </div>
    )
  }

  if (itemsError && !item) {
    return (
      <ErrorState
        title="Couldn't load this item"
        message={itemsError}
        onRetry={() => onRefreshItems?.()}
      />
    )
  }

  if (!item) {
    return (
      <EmptyState
        icon="items"
        title="Item not found"
        description="This listing may have been removed, completed, or is no longer available in your area."
        action={<Button as="link" to="/browse">Back to Browse</Button>}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-he-ink">
            Item Details
          </h1>
          <p className="text-[10px] text-he-muted">View the listing and make requests.</p>
        </div>
        <Button as="link" to="/browse" variant="ghost" className="h-7 min-h-0 px-2.5 text-[10px] text-he-purple hover:bg-he-purple/5">
          ← Back
        </Button>
      </div>

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

      <Surface className="p-4.5">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-he-soft">Description & Pickup Details</h2>
        <p className="mt-2 text-xs leading-relaxed text-he-muted">
          {safeString(item.description, 'No description provided.')}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-he-border/60 pt-3.5">
          <span className="rounded-full border border-he-border bg-he-surface-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-he-soft">
            {safeString(item.category, 'Uncategorized')}
          </span>
          <span className="rounded-full border border-he-border bg-he-surface-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-he-soft">
            {safeString(item.condition, 'Condition not listed')}
          </span>
          <span className="rounded-full border border-he-border bg-he-surface-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-he-soft">
            {safeString(item.location_display || item.location, 'Location unavailable')}
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
