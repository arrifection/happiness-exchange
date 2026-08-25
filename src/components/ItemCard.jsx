import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { showFlash } from '../lib/flash.js'
import { itemHasCustomImage, resolveItemImageUrl, ITEM_PLACEHOLDER_URL } from '../lib/itemImages.js'
import { userNeedsWhatsApp, WHATSAPP_REQUIRED_MESSAGE } from '../lib/whatsappRequirement.js'
import { isListingActive, isListingExpired } from '../lib/listingExpiration.js'
import ImagePreviewModal, { normalizeItemImages } from './ImagePreviewModal.jsx'
import { RatingStars } from './reputation.jsx'
import TrustBadge from './TrustBadge.jsx'
import ListingModeBadge from './ListingModeBadge.jsx'
import { Button, StatusBadge } from './ui.jsx'

function OwnerActionsMenu({ item, onDeleteItem, onCompleteItem, onRenewItem, ownerActionPending }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  async function handleAction(action) {
    setMenuOpen(false)
    await action?.(item)
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Open item actions"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((current) => !current)}
        disabled={ownerActionPending}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-he-border bg-he-surface-soft text-he-soft transition hover:border-he-border hover:bg-he-surface hover:text-he-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-he-purple/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {ownerActionPending ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v4m0 8v4m8-8h-4M8 12H4m13.657-5.657l-2.828 2.828M9.172 14.828l-2.829 2.829m11.314 0l-2.828-2.829M9.172 9.172 6.343 6.343" />
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        )}
      </button>

      {menuOpen ? (
        <div className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-2xl border border-he-border bg-he-surface p-1.5 shadow-xl shadow-black/20">
          {isListingExpired(item) ? (
            <button
              type="button"
              onClick={() => handleAction(onRenewItem)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-[#7340d2] transition hover:bg-[#f5efff]"
            >
              Renew for 14 days
            </button>
          ) : null}

          {item.status !== 'completed' && !isListingExpired(item) ? (
            <button
              type="button"
              onClick={() => handleAction(onCompleteItem)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-[#1f3328] transition hover:bg-[#f4efe7]"
            >
              <svg className="h-4 w-4 text-[#1f6f50]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
              </svg>
              Successfully Taken
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => handleAction(onDeleteItem)}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-[#c65d4a] transition hover:bg-[#fff3f0]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2m-7 4v7m6-7v7M6 6l1 14h10l1-14" />
            </svg>
            Delete Item
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function ItemCard({
  item,
  currentUser,
  myRequest,
  reviewContext,
  onCreateRequest,
  onOpenReview,
  onDeleteItem,
  onCompleteItem,
  onRenewItem,
  ownerActionPending = false,
  compact = false,
}) {
  const [imageAvailable, setImageAvailable] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const hasRealImage = itemHasCustomImage(item.image_url)
  const displayImage = resolveItemImageUrl(item.image_url)
  const itemImages = normalizeItemImages(item)
  const isOwner = item.owner_id === currentUser?.id
  const itemHref = `/items/${item.id}`

  useEffect(() => {
    setImageAvailable(true)
  }, [item.id, item.image_url])

  function renderAction() {
    if (isOwner) {
      return (
        <OwnerActionsMenu
          item={item}
          onDeleteItem={onDeleteItem}
          onCompleteItem={onCompleteItem}
          onRenewItem={onRenewItem}
          ownerActionPending={ownerActionPending}
        />
      )
    }

    if (!currentUser) {
      return null
    }

    if (reviewContext && onOpenReview) {
      return (
        <Button
          variant="secondary"
          className="h-7 min-h-0 border-[#8b4cf6]/20 px-2.5 text-[9px] text-[#8b4cf6] hover:bg-[#f5efff]"
          onClick={() => {
            if (!currentUser.is_verified) {
              showFlash('Please verify your email to leave a review.')
              return
            }
            onOpenReview(reviewContext)
          }}
        >
          Leave Review
        </Button>
      )
    }

    if (myRequest) {
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c755f]">My Request:</span>
          <StatusBadge status={myRequest.status} />
        </div>
      )
    }

    if (item.status !== 'available' || !isListingActive(item)) {
      return null
    }

    return (
      <Button 
        variant="primary" 
        className="h-7 min-h-0 px-2.5 text-[9px]" 
        onClick={() => {
          if (!currentUser.is_verified) {
            showFlash('Please verify your email to request an item.')
            return
          }
          if (userNeedsWhatsApp(currentUser)) {
            showFlash(WHATSAPP_REQUIRED_MESSAGE)
            return
          }
          onCreateRequest(item)
        }}
      >
        Interested
      </Button>
    )
  }

  return (
    <article className="group he-card flex overflow-hidden transition-all duration-300 hover:border-he-purple/30">
      <div className="relative aspect-square w-20 shrink-0 overflow-hidden bg-he-surface-soft sm:w-24">
        {item.status !== 'available' ? (
          <div className="absolute left-1.5 top-1.5 z-10 origin-top-left scale-85">
            <StatusBadge status={item.status} className="border-0 bg-he-surface/95 shadow-xs backdrop-blur-xs" />
          </div>
        ) : isOwner && isListingExpired(item) ? (
          <div className="absolute left-1.5 top-1.5 z-10 origin-top-left scale-85">
            <StatusBadge status="expired" className="border-0 bg-he-surface/95 shadow-xs backdrop-blur-xs" />
          </div>
        ) : isOwner ? (
          <div className="absolute left-1.5 top-1.5 z-10 origin-top-left scale-85">
            <StatusBadge status="active" className="border-0 bg-he-surface/95 shadow-xs backdrop-blur-xs" />
          </div>
        ) : null}
        {imageAvailable ? (
          hasRealImage ? (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-he-purple/40"
              aria-label={`View larger photo of ${item.title}`}
            >
              <img
                src={displayImage}
                alt={item.title}
                className="h-full w-full object-cover"
                onError={() => setImageAvailable(false)}
              />
            </button>
          ) : (
            <img
              src={displayImage}
              alt={`${item.title} — no photo provided`}
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.src = ITEM_PLACEHOLDER_URL
              }}
            />
          )
        ) : (
          <img
            src={ITEM_PLACEHOLDER_URL}
            alt={`${item.title} — no photo provided`}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <ImagePreviewModal
        open={previewOpen && hasRealImage}
        images={itemImages}
        alt="Item photo"
        title={item.title}
        onClose={() => setPreviewOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5 sm:p-3">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <Link to={itemHref} className="min-w-0 transition hover:text-[#8b4cf6]">
              <h3 className="line-clamp-1 font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold leading-tight text-he-ink">
                {item.title}
              </h3>
            </Link>
            <div className="flex items-center gap-1.5">
              {isOwner ? <span className="text-[9px] font-bold uppercase tracking-widest text-[#8b4cf6]">Yours</span> : null}
              {isOwner ? renderAction() : null}
            </div>
          </div>

            <Link to={itemHref} className="block rounded-lg transition">
              <div className="mb-1">
                <ListingModeBadge mode={item.listing_mode} />
              </div>
              {!isOwner ? (
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-[#8c755f]/80">
                <span>By {item.owner_name}</span>
                {item.owner_badge ? (
                  <TrustBadge
                    level={item.owner_badge}
                    trustScore={item.owner_trust_score || 0}
                    showPoints={false}
                    size="sm"
                  />
                ) : null}
              </div>
            ) : null}
            <p className="line-clamp-2 text-[10px] leading-normal text-he-muted">
              {item.description}
            </p>
          </Link>
        </div>

        <div className="mt-2 flex flex-row items-center justify-between gap-2 border-t border-he-border/40 pt-2">
          <div className="min-w-0">
            <Link to={itemHref} className="flex flex-wrap items-center gap-1 rounded-lg transition hover:text-[#8b4cf6]">
              <span className="text-[9px] font-bold uppercase tracking-tight text-[#8c755f]/70">{item.location_display || item.location}</span>
              <span className="text-[9px] font-bold uppercase tracking-tight text-[#8c755f]/40">/</span>
              <span className="text-[9px] font-bold uppercase tracking-tight text-[#8c755f]/70">{item.condition}</span>
            </Link>
            {!isOwner ? (
              <div className="mt-1">
                <RatingStars
                  rating={item.owner_average_rating || 0}
                  reviewCount={item.owner_review_count || 0}
                />
              </div>
            ) : null}
          </div>
          {!isOwner ? (
            <div className="shrink-0">
              {renderAction()}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
