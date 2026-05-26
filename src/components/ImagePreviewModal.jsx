import { useCallback, useEffect, useRef, useState } from 'react'

export function normalizeItemImages(item) {
  const gallery = Array.isArray(item?.images) ? item.images.filter(Boolean) : []
  if (gallery.length > 0) {
    return gallery
  }
  return item?.image_url ? [item.image_url] : []
}

export default function ImagePreviewModal({
  open,
  images = [],
  initialIndex = 0,
  alt = 'Item photo',
  title = '',
  onClose,
}) {
  const closeButtonRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const hasGallery = images.length > 1
  const currentImage = images[activeIndex] || images[0]

  useEffect(() => {
    if (!open) {
      return undefined
    }
    setActiveIndex(Math.min(initialIndex, Math.max(images.length - 1, 0)))
  }, [open, initialIndex, images.length])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const previousFocus = document.activeElement
    closeButtonRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.()
        return
      }
      if (!hasGallery) {
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setActiveIndex((index) => (index - 1 + images.length) % images.length)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setActiveIndex((index) => (index + 1) % images.length)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus()
      }
    }
  }, [open, hasGallery, images.length, onClose])

  const showPrevious = useCallback(() => {
    setActiveIndex((index) => (index - 1 + images.length) % images.length)
  }, [images.length])

  const showNext = useCallback(() => {
    setActiveIndex((index) => (index + 1) % images.length)
  }, [images.length])

  if (!open || !currentImage) {
    return null
  }

  const imageAlt = title ? `${alt}: ${title}` : alt

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f0e12]/85 p-3 backdrop-blur-sm md:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col items-center"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title ? `Image preview for ${title}` : 'Image preview'}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute -top-1 right-0 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:-right-2 md:-top-2"
          aria-label="Close image preview"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>

        <div className="relative flex w-full items-center justify-center">
          {hasGallery ? (
            <button
              type="button"
              onClick={showPrevious}
              className="absolute left-0 z-10 hidden h-11 w-11 -translate-x-2 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:inline-flex md:-translate-x-14"
              aria-label="Previous image"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19 8 12l7-7" />
              </svg>
            </button>
          ) : null}

          <img
            src={currentImage}
            alt={imageAlt}
            className="max-h-[78vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl shadow-black/40"
          />

          {hasGallery ? (
            <button
              type="button"
              onClick={showNext}
              className="absolute right-0 z-10 hidden h-11 w-11 translate-x-2 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:inline-flex md:translate-x-14"
              aria-label="Next image"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
              </svg>
            </button>
          ) : null}
        </div>

        {title ? (
          <p className="mt-3 max-w-full truncate px-2 text-center text-xs font-medium text-white/85 md:text-sm">
            {title}
          </p>
        ) : null}

        {hasGallery ? (
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
            {activeIndex + 1} / {images.length}
          </p>
        ) : null}
      </div>
    </div>
  )
}
