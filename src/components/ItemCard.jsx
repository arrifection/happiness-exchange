import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button, StatusBadge } from './ui.jsx'

function OwnerActionsMenu({ item, onDeleteItem, onCompleteItem, ownerActionPending }) {
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
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#eadfce] bg-[#faf7f1] text-[#8c755f] transition hover:border-[#d8cab8] hover:bg-white hover:text-[#1f3328] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f50]/20 disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-2xl border border-[#eadfce] bg-white p-1.5 shadow-xl shadow-[#1f3328]/10">
          {item.status !== 'completed' ? (
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
  onCreateRequest,
  onDeleteItem,
  onCompleteItem,
  ownerActionPending = false,
  compact = false,
}) {
  const [imageAvailable, setImageAvailable] = useState(Boolean(item.image_url))
  const isOwner = item.owner_id === currentUser?.id
  const itemHref = `/items/${item.id}`

  function renderAction() {
    if (isOwner) {
      return (
        <OwnerActionsMenu
          item={item}
          onDeleteItem={onDeleteItem}
          onCompleteItem={onCompleteItem}
          ownerActionPending={ownerActionPending}
        />
      )
    }

    if (!currentUser) {
      return null
    }

    if (myRequest) {
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c755f]">My Request:</span>
          <StatusBadge status={myRequest.status} />
        </div>
      )
    }

    if (item.status !== 'available') {
      return null
    }
 
    return (
      <Button variant="primary" className="h-7 min-h-0 px-2.5 text-[9px]" onClick={() => onCreateRequest(item.id)}>
        Interested
      </Button>
    )
  }
 
  return (
    <article className="group flex overflow-hidden rounded-card border border-[#efe8da] bg-white transition-all duration-300 hover:shadow-md md:hover:-translate-y-1 md:hover:scale-[1.01] md:hover:border-[#8b4cf6]/30">
      <Link
        to={itemHref}
        className="relative aspect-square w-22 shrink-0 overflow-hidden bg-[#faf7f1] sm:w-26"
        aria-label={`Open ${item.title}`}
      >
        {item.status !== 'available' && (
          <div className="absolute left-1.5 top-1.5 z-10 scale-85 origin-top-left">
            <StatusBadge status={item.status} className="border-0 shadow-xs backdrop-blur-xs bg-white/95" />
          </div>
        )}
        {item.image_url && imageAvailable ? (
          <img
            src={item.image_url}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImageAvailable(false)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/40">
            No image
          </div>
        )}
      </Link>
 
      <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <Link to={itemHref} className="min-w-0 transition hover:text-[#8b4cf6]">
              <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold leading-tight text-[#1f1f1f] line-clamp-1">{item.title}</h3>
            </Link>
            <div className="flex items-center gap-1.5">
              {isOwner && <span className="text-[9px] font-bold uppercase tracking-widest text-[#8b4cf6]">Yours</span>}
              {isOwner ? renderAction() : null}
            </div>
          </div>
          <Link to={itemHref} className="block rounded-lg transition">
            <p className="line-clamp-2 text-[10px] leading-normal text-[#68766d]">
              {item.description}
            </p>
          </Link>
        </div>
 
        <div className="mt-2 flex flex-row items-center justify-between gap-2 border-t border-[#fcfbf9] pt-2">
          <Link to={itemHref} className="flex flex-wrap items-center gap-1 rounded-lg transition hover:text-[#8b4cf6]">
            <span className="text-[9px] font-bold uppercase tracking-tight text-[#8c755f]/70">{item.location}</span>
            <span className="text-[9px] font-bold uppercase tracking-tight text-[#8c755f]/40">•</span>
            <span className="text-[9px] font-bold uppercase tracking-tight text-[#8c755f]/70">{item.condition}</span>
          </Link>
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
