import { useEffect, useMemo, useState } from 'react'

import { Button, SelectField, TextAreaField, TextField } from './ui.jsx'
import LocationSelector from './LocationSelector.jsx'
import { DEFAULT_COUNTRY } from '../lib/locations.js'
import { ITEM_CATEGORIES, STORAGE_CONDITIONS } from '../lib/categories.js'

const CATEGORIES = ITEM_CATEGORIES

const CONDITIONS = ['New', 'Like New', 'Good', 'Gently Used', 'Used']

const fieldHelpText = {
  title: 'Give your item a clear, concise name.',
  description: 'Describe condition, usage, and pickup details clearly.',
  category: 'Choose the best category for your item.',
  condition: 'Be honest about the current state.',
  location: 'Choose country and city, or use current location.',
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
    errors.description = 'Description is required.'
  } else if (itemForm.description.trim().length < 30) {
    errors.description = 'Please provide at least 30 characters.'
  }

  if (!itemForm.category) {
    errors.category = 'Please select a category.'
  }

  if (!itemForm.condition) {
    errors.condition = 'Please select the condition.'
  }

  if (!itemForm.country) {
    errors.country = 'Please select a country.'
  }

  if (itemForm.location_source === 'current_location') {
    if (itemForm.latitude == null || itemForm.longitude == null) {
      errors.location = 'Please use current location or select a city manually.'
    }
  } else {
    if (!itemForm.city) {
      errors.city = 'Please select a city.'
    }
    if (!itemForm.location?.trim()) {
      errors.location = 'Location is required.'
    }
  }

  if (!itemForm.image_url?.trim()) {
    errors.image_url = 'An item image is required.'
  }

  return errors
}

function PreviewCard({ itemForm, imageAvailable, onImageError }) {
  const previewTitle = itemForm.title.trim() || 'Item Preview'
  const previewDescription = itemForm.description.trim() || 'Detailed description will appear here...'
  const previewCategory = itemForm.category || 'Category'
  const previewCondition = itemForm.condition || 'Condition'
  const previewLocation = itemForm.location_display || itemForm.location || 'Location'
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
    <div className="flex flex-col md:flex-row gap-6 md:gap-10">
      <form className="flex-1 flex flex-col gap-4.5" onSubmit={handleFormSubmit} noValidate>
        <div className="space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8b4cf6]">List an Item</p>
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-[#1f1f1f]">
            Give with Joy
          </h2>
          <p className="text-xs leading-relaxed text-[#68766d]">
            Fill in the details below to share your item with neighbors.
          </p>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2">
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

          <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-3">
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

            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#a07d22] dark:text-he-yellow">Pickup Location</p>
              <LocationSelector
                country={itemForm.country || DEFAULT_COUNTRY}
                city={itemForm.city || ''}
                area={itemForm.area || ''}
                latitude={itemForm.latitude ?? null}
                longitude={itemForm.longitude ?? null}
                locationSource={itemForm.location_source || 'manual'}
                onChange={(locationValues) => {
                  onChange({
                    target: {
                      name: 'location_bundle',
                      value: locationValues,
                    },
                  })
                }}
                disabled={disabled}
                showMapPicker
                defaultMapOpen
              />
              <p className={`mt-1 text-[9px] ${fieldErrors.location || fieldErrors.city || fieldErrors.country ? 'font-bold text-[#c65d4a]' : 'text-[#8c755f]/60'}`}>
                {fieldErrors.location || fieldErrors.city || fieldErrors.country || fieldHelpText.location}
              </p>
            </div>
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
            <label className="grid gap-1" htmlFor="item-image_file">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22]">Item Image</span>
              <div className="rounded-input border border-dashed border-[#efe8da] bg-[#fffdfb] p-3">
                <input
                  id="item-image_file"
                  name="image_file"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={uploadingItemImage}
                  required
                  className="block w-full cursor-pointer text-xs text-[#1f1f1f] file:mr-3 file:rounded-btn file:border-0 file:bg-[#efe7ff] file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:uppercase file:tracking-widest file:text-[#7340d2] hover:file:bg-[#e4d8ff] disabled:cursor-not-allowed disabled:opacity-60"
                />
                <p className="mt-2 text-[10px] leading-relaxed text-[#68766d]">
                  Select a JPG, PNG, or WEBP image (max 5 MB).
                </p>
              </div>
            </label>
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
              placeholder="Describe condition, usage, and pickup details clearly."
              rows={4}
              required
            />
            <p className={`mt-1 text-[9px] ${fieldErrors.description ? 'font-bold text-[#c65d4a]' : 'text-[#8c755f]/60'}`}>
              {fieldErrors.description || fieldHelpText.description}
            </p>
          </div>
        </div>

        <div className="pt-2">
          {disabled && (
             <div className="mb-4 text-center text-[12px] font-bold text-[#c65d4a] bg-[#fff3f0] p-2 rounded">
               Please verify your email to publish items.
             </div>
          )}
          <Button
            type="submit"
            disabled={disabled || creatingItem || uploadingItemImage || hasValidationErrors || !itemForm.image_url?.trim()}
            className="h-10 w-full text-xs shadow-xs md:text-[13px] md:h-11"
          >
            {uploadingItemImage ? 'Uploading Image...' : creatingItem ? 'Publishing Listing...' : 'Publish to Community'}
          </Button>

          {itemMessage && (
            <div className="mt-3 rounded-xl bg-[#8b4cf6]/5 p-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-[#8b4cf6]">
              {itemMessage}
            </div>
          )}
          {itemError && (
            <div className="mt-3 rounded-xl bg-[#c65d4a]/5 p-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-[#c65d4a]">
              {itemError}
            </div>
          )}
        </div>
      </form>

      <hr className="border-[#efe8da] md:hidden" />

      {/* Right Sidebar: Preview & Tips */}
      <div className="space-y-4 shrink-0 md:w-72 lg:w-80">
        <div className="space-y-0.5 md:hidden">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8c755f]">Live Preview</p>
          <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-xs font-bold text-[#1f1f1f]">Check your listing</h3>
        </div>
        <PreviewCard
          itemForm={itemForm}
          imageAvailable={imageAvailable}
          onImageError={() => setImageAvailable(false)}
        />
        <div className="rounded-card bg-[#faf7f1] border border-[#efe8da]/60 p-3.5 md:p-5">
          <h4 className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#1f1f1f]">Why details matter</h4>
          <p className="mt-1 text-[10px] md:text-xs md:leading-relaxed leading-relaxed text-[#68766d]">
            Items with clear photos and detailed descriptions are 3x more likely to find a new home quickly. Be sure to mention if there's minor wear or specific pickup times.
          </p>
        </div>
      </div>
    </div>
  )
}
