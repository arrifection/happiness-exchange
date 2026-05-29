import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import ItemLocationMapModal from '../components/map/ItemLocationMapModal.jsx'
import ImagePreviewModal, { normalizeItemImages } from '../components/ImagePreviewModal.jsx'
import { RatingStars } from '../components/reputation.jsx'
import TrustBadge from '../components/TrustBadge.jsx'
import { Button, EmptyState, ErrorState, ItemCardSkeleton, StatusBadge } from '../components/ui.jsx'
import { storageConditionLabel } from '../lib/categories.js'
import { showFlash } from '../lib/flash.js'
import { itemHasCustomImage, resolveItemImageUrl, ITEM_PLACEHOLDER_URL } from '../lib/itemImages.js'
import { getPublicLocationLabel } from '../lib/locations.js'
import { safeString } from '../lib/safeValues.js'

import './ItemDetailsPage.css'

function LocationPinIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.5 7-10a7 7 0 1 0-14 0c0 5.5 7 10 7 10Z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  )
}

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
  const [previewOpen, setPreviewOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)

  const item = useMemo(() => {
    const pool = [...(myItems || []), ...(items || [])]
    return pool.find((entry) => entry.id === itemId) || null
  }, [itemId, items, myItems])

  const hasRealImage = item ? itemHasCustomImage(item.image_url) : false
  const displayImage = item ? resolveItemImageUrl(item.image_url) : ITEM_PLACEHOLDER_URL
  const itemImages = item ? normalizeItemImages(item) : []
  const isOwner = item?.owner_id === currentUser?.id
  const myRequest = item ? getMyRequestForItem(item.id) : null
  const reviewContext = item ? getReviewContextForItem(item) : null
  const ownerActionPending = ownerActionItemId === item?.id

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (loadingItems && !item) {
    return (
      <div className="he-item-details">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-he-ink">
              Item Details
            </h1>
            <p className="text-[10px] text-he-muted">Loading listing…</p>
          </div>
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

  function renderPrimaryAction() {
    if (isOwner) {
      return (
        <div className="flex flex-wrap gap-2">
          {item.status !== 'completed' ? (
            <Button
              variant="secondary"
              disabled={ownerActionPending}
              onClick={() => onCompleteItem?.(item)}
            >
              Mark as taken
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="text-he-danger"
            disabled={ownerActionPending}
            onClick={() => onDeleteItem?.(item)}
          >
            Delete item
          </Button>
        </div>
      )
    }

    if (reviewContext && onOpenReview) {
      return (
        <Button
          variant="secondary"
          onClick={() => {
            if (!currentUser.is_verified) {
              showFlash('Please verify your email to leave a review.')
              return
            }
            onOpenReview(reviewContext)
          }}
        >
          Leave review
        </Button>
      )
    }

    if (myRequest) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-he-soft">Your request</span>
          <StatusBadge status={myRequest.status} />
        </div>
      )
    }

    if (item.status !== 'available') {
      return null
    }

    return (
      <Button
        variant="primary"
        onClick={() => {
          if (!currentUser.is_verified) {
            showFlash('Please verify your email to request an item.')
            return
          }
          onCreateRequest(item.id)
        }}
      >
        Request this item
      </Button>
    )
  }

  return (
    <div className="he-item-details">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-he-ink">
            Item Details
          </h1>
          <p className="text-[10px] text-he-muted">View the listing and take your next step.</p>
        </div>
        <Button as="link" to="/browse" variant="ghost" className="h-7 min-h-0 px-2.5 text-[10px] text-he-purple hover:bg-he-purple/5">
          ← Back
        </Button>
      </div>

      <article className="he-item-details-hero">
        <div className="he-item-details-image-wrap">
          {item.status !== 'available' ? (
            <div className="absolute left-3 top-3 z-10">
              <StatusBadge status={item.status} />
            </div>
          ) : null}

          {hasRealImage && !imageFailed ? (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              aria-label={`View larger photo of ${item.title}`}
            >
              <img
                src={displayImage}
                alt={item.title}
                onError={() => setImageFailed(true)}
              />
            </button>
          ) : (
            <img
              src={imageFailed ? ITEM_PLACEHOLDER_URL : displayImage}
              alt={item.title}
              onError={(event) => {
                event.currentTarget.src = ITEM_PLACEHOLDER_URL
              }}
            />
          )}
        </div>

        <div className="he-item-details-body">
          <h2 className="he-item-details-title">{item.title}</h2>

          <div className="he-item-details-meta">
            <span>{safeString(item.category, 'Other')}</span>
            <span>·</span>
            <span>{safeString(item.condition, 'Good')}</span>
            {!isOwner ? (
              <>
                <span>·</span>
                <span>By {item.owner_name}</span>
                {item.owner_badge ? (
                  <TrustBadge
                    level={item.owner_badge}
                    trustScore={item.owner_trust_score || 0}
                    showPoints={false}
                    size="sm"
                  />
                ) : null}
              </>
            ) : (
              <span className="text-he-purple">Your listing</span>
            )}
          </div>

          {!isOwner ? (
            <div className="mt-2">
              <RatingStars
                rating={item.owner_average_rating || 0}
                reviewCount={item.owner_review_count || 0}
              />
            </div>
          ) : null}

          <div className="he-item-details-actions">
            {renderPrimaryAction()}
          </div>
        </div>
      </article>

      <div className="he-item-details-location">
        <div className="he-item-details-location-label">
          <p>Pickup area</p>
          <p>{getPublicLocationLabel(item)}</p>
        </div>
        <button
          type="button"
          className="he-item-details-map-btn"
          onClick={() => setMapOpen(true)}
        >
          <LocationPinIcon />
          View on map
        </button>
      </div>

      <section className="he-item-details-card">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-he-soft">Description</h3>
        <p className="mt-2 text-sm leading-relaxed text-he-muted">
          {safeString(item.description, 'No description provided.')}
        </p>

        <div className="he-item-details-tags">
          <span className="rounded-full border border-he-border bg-he-surface-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-he-soft">
            {safeString(item.category, 'Uncategorized')}
          </span>
          <span className="rounded-full border border-he-border bg-he-surface-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-he-soft">
            {safeString(item.condition, 'Condition not listed')}
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
      </section>

      <ImagePreviewModal
        open={previewOpen && hasRealImage}
        images={itemImages}
        alt="Item photo"
        title={item.title}
        onClose={() => setPreviewOpen(false)}
      />

      <ItemLocationMapModal
        open={mapOpen}
        item={item}
        onClose={() => setMapOpen(false)}
      />
    </div>
  )
}
