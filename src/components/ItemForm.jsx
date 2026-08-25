import { useEffect, useMemo, useRef, useState } from 'react'

import GiveItemLocationModal, { hasGiveItemLocation } from './GiveItemLocationModal.jsx'
import ImagePreviewModal from './ImagePreviewModal.jsx'
import { Button, SelectField, TextAreaField, TextField } from './ui.jsx'
import { ITEM_CATEGORIES, STORAGE_CONDITIONS } from '../lib/categories.js'

const CATEGORIES = ITEM_CATEGORIES

const CONDITIONS = ['New', 'Like New', 'Good', 'Gently Used', 'Used']

const fieldHelpText = {
  title: 'Give your item a clear, concise name.',
  description: 'A few words about condition and pickup is enough.',
  category: 'Choose the best category for your item.',
  condition: 'Be honest about the current state.',
  image_url: 'Upload a clear image from your device. Images only, up to 5 MB.',
}

function validateItemForm(itemForm) {
  const errors = {}

  if (!itemForm.owner_name?.trim()) {
    errors.owner_name = 'Your name is required.'
  }

  if (!itemForm.title?.trim()) {
    errors.title = 'Item title is required.'
  } else if (itemForm.title.trim().length < 3) {
    errors.title = 'Title must be at least 3 characters.'
  }

  if (!itemForm.description?.trim()) {
    errors.description = 'Please add a short description.'
  } else if (itemForm.description.trim().length < 3) {
    errors.description = 'Please add a short description.'
  }

  if (!itemForm.category) {
    errors.category = 'Please select a category.'
  }

  if (!itemForm.condition) {
    errors.condition = 'Please select the condition.'
  }

  if (!itemForm.image_url?.trim()) {
    errors.image_url = 'An item image is required.'
  }

  return errors
}

function PinIcon({ className = '' }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.5 7-10a7 7 0 1 0-14 0c0 5.5 7 10 7 10Z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  )
}

function GiveItemLocationPill({ itemForm, onOpenSetup }) {
  const hasLocation = hasGiveItemLocation(itemForm)
  const summary = itemForm.location_display || itemForm.location || itemForm.city

  return (
    <div className="flex min-h-[4.5rem] w-full max-w-full items-center gap-3 rounded-input border border-he-border bg-he-surface-soft px-3 py-2.5 sm:gap-3.5 sm:px-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-he-purple/10">
        <PinIcon className="text-he-purple" />
      </div>

      <div className="min-w-0 flex-1">
        {hasLocation ? (
          <>
            <p className="text-xs font-bold leading-tight text-he-ink">Pickup location added</p>
            {summary ? (
              <p className="mt-0.5 truncate text-[10px] leading-snug text-he-muted">{summary}</p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-xs font-bold leading-tight text-he-ink">Add pickup location</p>
            <p className="mt-0.5 text-[10px] leading-snug text-he-muted">
              Optional — exact address stays private.
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenSetup}
        className="shrink-0 rounded-full border border-he-purple/25 bg-he-purple/8 px-3 py-1.5 text-[10px] font-bold text-he-purple transition hover:border-he-purple/40 hover:bg-he-purple/12 sm:px-3.5 sm:py-2 sm:text-[11px]"
      >
        {hasLocation ? 'Change' : 'Set location'}
      </button>
    </div>
  )
}

function PreviewCard({ itemForm, imageAvailable, onImageError }) {
  const previewTitle = itemForm.title.trim() || 'Item Preview'
  const previewDescription = itemForm.description.trim() || 'Description will appear here…'
  const previewCategory = itemForm.category || 'Category'
  const previewCondition = itemForm.condition || 'Condition'
  const previewLocation = itemForm.location_display || itemForm.location || 'Location optional'
  const previewOwner = itemForm.owner_name?.trim() || 'Your Name'

  return (
    <div className="he-card flex overflow-hidden">
      <div className="relative aspect-square w-20 shrink-0 overflow-hidden bg-he-surface-soft sm:w-24">
        {itemForm.image_url.trim() && imageAvailable ? (
          <img
            src={itemForm.image_url.trim()}
            alt={previewTitle}
            className="h-full w-full object-cover"
            onError={onImageError}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-3 text-center">
            <svg className="mb-1 h-5 w-5 text-he-soft/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[8px] font-bold uppercase tracking-widest text-he-soft/50">Photo Preview</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between p-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold leading-tight text-he-ink line-clamp-1">{previewTitle}</h3>
            <span className="shrink-0 rounded-full bg-he-purple/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-he-purple">
              {previewCategory}
            </span>
          </div>
          <p className="line-clamp-2 text-[10px] leading-relaxed text-[#68766d]">
            {previewDescription}
          </p>
        </div>

        <div className="mt-2 border-t border-[#fcfbf9] pt-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-tight text-[#8c755f]">
              <span>{previewLocation}</span>
              <span className="opacity-30">•</span>
              <span>{previewCondition}</span>
            </div>
            <span className="text-[9px] font-bold text-[#8b4cf6]/75">By {previewOwner.split(' ')[0]}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ItemForm({
  itemForm,
  onChange,
  onImageUpload,
  onSubmit,
  creatingItem,
  uploadingItemImage,
  itemMessage,
  itemError,
  imageUploadMessage,
  imageUploadError,
  disabled,
}) {
  const [fieldErrors, setFieldErrors] = useState({})
  const [imageAvailable, setImageAvailable] = useState(false)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (itemForm.image_url?.trim()) {
      setImageAvailable(true)
    } else {
      setImageAvailable(false)
    }
  }, [itemForm.image_url])

  const hasValidationErrors = useMemo(
    () => Object.keys(fieldErrors).length > 0,
    [fieldErrors],
  )

  const previewImages = useMemo(
    () => (itemForm.image_url?.trim() && imageAvailable ? [itemForm.image_url.trim()] : []),
    [itemForm.image_url, imageAvailable],
  )

  function handleFormChange(event) {
    const { name, type, checked, value } = event.target
    if (type === 'checkbox') {
      onChange({ target: { name, value: checked } })
    } else {
      onChange(event)
    }

    if (fieldErrors[name]) {
      setFieldErrors((current) => {
        const updated = { ...current }
        delete updated[name]
        return updated
      })
    }
  }

  function handleLocationSave(values) {
    onChange({
      target: {
        name: 'location_bundle',
        value: values,
      },
    })
  }

  async function handleImageChange(event) {
    const [file] = event.target.files || []

    if (fieldErrors.image_url) {
      setFieldErrors((current) => {
        const updated = { ...current }
        delete updated.image_url
        return updated
      })
    }

    await onImageUpload(file)
    event.target.value = ''
  }

  function openFilePicker() {
    if (uploadingItemImage) return
    fileInputRef.current?.click()
  }

  async function handleFormSubmit(event) {
    event.preventDefault()
    const nextErrors = validateItemForm(itemForm)

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})
    await onSubmit(event)
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-10">
      <form className="flex flex-1 flex-col gap-4" onSubmit={handleFormSubmit} noValidate>
        <div className="space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8b4cf6]">List an Item</p>
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-[#1f1f1f]">
            Give with Joy
          </h2>
          <p className="text-xs leading-relaxed text-[#68766d]">
            Fill in the details below to share your item with neighbors.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <TextField
                id="item-owner_name"
                name="owner_name"
                label="Your Name"
                value={itemForm.owner_name}
                onChange={handleFormChange}
                placeholder="Your name"
                required
              />
              <p className={`mt-1 text-[9px] ${fieldErrors.owner_name ? 'font-bold text-[#c65d4a]' : 'text-[#8c755f]/60'}`}>
                {fieldErrors.owner_name || fieldHelpText.owner_name}
              </p>
            </div>

            <div>
              <TextField
                id="item-title"
                name="title"
                label="Item Title"
                value={itemForm.title}
                onChange={handleFormChange}
                placeholder="e.g. Dining Table"
                required
              />
              <p className={`mt-1 text-[9px] ${fieldErrors.title ? 'font-bold text-[#c65d4a]' : 'text-[#8c755f]/60'}`}>
                {fieldErrors.title || fieldHelpText.title}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <SelectField
                id="item-category"
                name="category"
                label="Category"
                value={itemForm.category}
                onChange={handleFormChange}
                options={CATEGORIES}
                placeholder="Select..."
                required
              />
              <p className={`mt-1 text-[9px] ${fieldErrors.category ? 'font-bold text-[#c65d4a]' : 'text-[#8c755f]/60'}`}>
                {fieldErrors.category || fieldHelpText.category}
              </p>
            </div>

            <div>
              <SelectField
                id="item-condition"
                name="condition"
                label="Condition"
                value={itemForm.condition}
                onChange={handleFormChange}
                options={CONDITIONS}
                placeholder="Select..."
                required
              />
              <p className={`mt-1 text-[9px] ${fieldErrors.condition ? 'font-bold text-[#c65d4a]' : 'text-[#8c755f]/60'}`}>
                {fieldErrors.condition || fieldHelpText.condition}
              </p>
            </div>
          </div>

          <div>
            <label className="grid gap-1.5" htmlFor="item-listing-mode">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22]">Listing type</span>
              <select
                id="item-listing-mode"
                name="listing_mode"
                value={itemForm.listing_mode || 'GIVEAWAY'}
                onChange={handleFormChange}
                className="h-10 w-full rounded-input border border-he-border bg-he-input px-3 text-sm text-he-ink outline-none transition focus:border-he-purple focus:ring-2 focus:ring-he-purple/10"
              >
                <option value="GIVEAWAY">Give Away only</option>
                <option value="EXCHANGE">Exchange / Swap only</option>
                <option value="BOTH">Give Away and Exchange</option>
              </select>
            </label>
            <p className="mt-1 text-[9px] text-[#8c755f]/60">
              {(itemForm.listing_mode || 'GIVEAWAY') === 'EXCHANGE'
                ? 'This listing will only accept swap offers, not Give Away requests.'
                : 'Choose whether this listing accepts give-away requests, swap offers, or both.'}
            </p>
          </div>

          <div>
            <GiveItemLocationPill
              itemForm={itemForm}
              onOpenSetup={() => setLocationModalOpen(true)}
            />
          </div>

          {itemForm.category === 'Food' ? (
            <div className="space-y-3 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200">Food safety</p>
              <p className="text-[10px] leading-relaxed text-amber-900/80 dark:text-amber-100/80">
                Only share sealed, safe, non-expired food. Mention the expiry date in the description when applicable.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField
                  id="item-expiry-date"
                  name="expiry_date"
                  label="Expiry date (optional)"
                  type="date"
                  value={itemForm.expiry_date || ''}
                  onChange={handleFormChange}
                  disabled={disabled}
                />
                <div>
                  <label className="grid gap-1.5" htmlFor="item-storage-condition">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22] dark:text-he-yellow">Storage (optional)</span>
                    <div className="relative">
                      <select
                        id="item-storage-condition"
                        name="storage_condition"
                        value={itemForm.storage_condition || ''}
                        onChange={handleFormChange}
                        disabled={disabled}
                        className="h-10 w-full appearance-none rounded-input border border-he-border bg-he-input px-3 pr-10 text-sm text-he-ink outline-none transition focus:border-he-purple focus:ring-2 focus:ring-he-purple/10"
                      >
                        <option value="">Select storage</option>
                        {STORAGE_CONDITIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </label>
                </div>
                <label className="flex items-center gap-2 self-end rounded-input border border-[#efe8da] bg-[#fffdfb] px-3 py-2.5 text-xs font-medium text-[#1f1f1f] dark:border-he-border dark:bg-he-surface dark:text-he-ink">
                  <input
                    type="checkbox"
                    name="sealed_packaging"
                    checked={Boolean(itemForm.sealed_packaging)}
                    onChange={handleFormChange}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-[#efe8da] text-[#8b4cf6] focus:ring-[#8b4cf6]/20"
                  />
                  Sealed packaging
                </label>
              </div>
            </div>
          ) : null}

          <div>
            <div className="grid gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22]">Item Image</span>

              <input
                ref={fileInputRef}
                id="item-image_file"
                name="image_file"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={uploadingItemImage}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />

              {itemForm.image_url?.trim() && imageAvailable ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setImagePreviewOpen(true)}
                    className="group relative w-full overflow-hidden rounded-xl border border-he-border bg-he-surface-soft"
                    aria-label="View uploaded image larger"
                  >
                    <img
                      src={itemForm.image_url.trim()}
                      alt={itemForm.title?.trim() || 'Uploaded item photo'}
                      className="aspect-[4/3] w-full object-cover"
                      onError={() => setImageAvailable(false)}
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 py-2 text-left text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                      Tap to view larger
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={uploadingItemImage}
                    className="text-[10px] font-bold text-he-purple hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Replace image
                  </button>
                </div>
              ) : (
                <div className="flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-input border border-dashed border-[#efe8da] bg-[#fffdfb] px-3 py-4 text-center">
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={uploadingItemImage}
                    className="inline-flex min-h-9 items-center justify-center rounded-btn border-0 bg-[#efe7ff] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#7340d2] transition hover:bg-[#e4d8ff] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadingItemImage ? 'Uploading…' : 'Choose image'}
                  </button>
                  <p className="text-[10px] leading-relaxed text-[#68766d]">
                    JPG, PNG, or WEBP · max 5 MB
                  </p>
                </div>
              )}
            </div>
            <p
              className={`mt-1 text-[9px] ${
                fieldErrors.image_url || imageUploadError
                  ? 'font-bold text-[#c65d4a]'
                  : imageUploadMessage
                    ? 'font-bold text-[#8b4cf6]'
                    : 'text-[#8c755f]/60'
              }`}
            >
              {fieldErrors.image_url
                || imageUploadError
                || (uploadingItemImage ? 'Uploading image...' : '')
                || imageUploadMessage
                || fieldHelpText.image_url}
            </p>
          </div>

          <div>
            <TextAreaField
              id="item-description"
              name="description"
              label="Description"
              value={itemForm.description}
              onChange={handleFormChange}
              placeholder="Describe condition, usage, or pickup notes."
              rows={3}
              required
            />
            <p className={`mt-1 text-[9px] ${fieldErrors.description ? 'font-bold text-[#c65d4a]' : 'text-[#8c755f]/60'}`}>
              {fieldErrors.description || fieldHelpText.description}
            </p>
          </div>
        </div>

        <div className="pt-1">
          {disabled && (
             <div className="mb-4 rounded bg-[#fff3f0] p-2 text-center text-[12px] font-bold text-[#c65d4a]">
               Please verify your email to publish items.
             </div>
          )}
          <Button
            type="submit"
            disabled={disabled || creatingItem || uploadingItemImage || hasValidationErrors || !itemForm.image_url?.trim()}
            className="h-10 w-full text-xs shadow-xs md:h-11 md:text-[13px]"
          >
            {uploadingItemImage ? 'Uploading Image...' : creatingItem ? 'Publishing Listing...' : 'Publish to Community'}
          </Button>

          {itemMessage ? (
            <div className="mt-3 rounded-xl bg-[#8b4cf6]/5 p-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-[#8b4cf6]">
              {itemMessage}
            </div>
          ) : null}
          {itemError ? (
            <div className="mt-3 rounded-xl bg-[#c65d4a]/5 p-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-[#c65d4a]">
              {itemError}
            </div>
          ) : null}
        </div>
      </form>

      <hr className="border-[#efe8da] md:hidden" />

      <div className="shrink-0 space-y-4 md:w-72 lg:w-80">
        <div className="space-y-0.5 md:hidden">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8c755f]">Live Preview</p>
          <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-xs font-bold text-[#1f1f1f]">Check your listing</h3>
        </div>
        <PreviewCard
          itemForm={itemForm}
          imageAvailable={imageAvailable}
          onImageError={() => setImageAvailable(false)}
        />
        <div className="rounded-card border border-[#efe8da]/60 bg-[#faf7f1] p-3.5 md:p-5">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#1f1f1f] md:text-xs">Why details matter</h4>
          <p className="mt-1 text-[10px] leading-relaxed text-[#68766d] md:text-xs md:leading-relaxed">
            Clear photos and honest descriptions help your item find a new home faster.
          </p>
        </div>
      </div>

      <GiveItemLocationModal
        open={locationModalOpen}
        initialValues={itemForm}
        onSave={handleLocationSave}
        onClose={() => setLocationModalOpen(false)}
      />

      <ImagePreviewModal
        open={imagePreviewOpen}
        images={previewImages}
        title={itemForm.title?.trim() || 'Item photo'}
        alt="Uploaded item photo"
        onClose={() => setImagePreviewOpen(false)}
      />
    </div>
  )
}
