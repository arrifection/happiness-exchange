import { useEffect, useMemo, useState } from 'react'

import { Button, SelectField, TextAreaField, TextField } from './ui.jsx'

const CATEGORIES = [
  'Furniture', 'Home', 'Kitchen', 'Electronics',
  'Clothes', 'Baby', 'Books', 'Appliances',
  'Study', 'Sports', 'Toys', 'Other',
]

const CONDITIONS = ['New', 'Like New', 'Good', 'Gently Used', 'Used']

const LOCATIONS = [
  'Lahore', 'Karachi', 'Islamabad', 'Rawalpindi',
  'Faisalabad', 'Multan', 'Gujranwala', 'Sialkot',
  'Peshawar', 'Quetta', 'Hyderabad', 'Bahawalpur',
  'Sargodha', 'Mandi Bahauddin', 'Sukkur', 'Larkana',
  'Sheikhupura', 'Jhang', 'Rahim Yar Khan', 'Kasur',
]

const fieldHelpText = {
  owner_name: 'Your name as it will appear to neighbors.',
  title: 'Give your item a clear, concise name.',
  description: 'Describe condition, usage, and pickup details clearly.',
  category: 'Choose the best category for your item.',
  condition: 'Be honest about the current state.',
  location: 'Select your city for pickup.',
  image_url: 'A clear photo helps your item find a home faster.',
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

  if (!itemForm.location) {
    errors.location = 'Please select a location.'
  }

  if (!itemForm.image_url?.trim()) {
    errors.image_url = 'An image URL is now required.'
  } else {
    try {
      new URL(itemForm.image_url.trim())
    } catch {
      errors.image_url = 'Please enter a valid URL (e.g. https://...).'
    }
  }

  return errors
}

function PreviewCard({ itemForm, imageAvailable, onImageError }) {
  const previewTitle = itemForm.title.trim() || 'Item Preview'
  const previewDescription = itemForm.description.trim() || 'Detailed description will appear here...'
  const previewCategory = itemForm.category || 'Category'
  const previewCondition = itemForm.condition || 'Condition'
  const previewLocation = itemForm.location || 'Location'
  const previewOwner = itemForm.owner_name?.trim() || 'Your Name'

  return (
    <div className="flex overflow-hidden rounded-2xl border border-[#eadfce] bg-white shadow-sm transition-all duration-500">
      <div className="relative aspect-square w-28 shrink-0 overflow-hidden bg-[#f4efe7] sm:w-36">
        {itemForm.image_url.trim() && imageAvailable ? (
          <img
            src={itemForm.image_url.trim()}
            alt={previewTitle}
            className="h-full w-full object-cover"
            onError={onImageError}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <svg className="mb-2 h-6 w-6 text-[#8c755f]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/40">Photo Preview</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[15px] font-bold leading-tight text-[#1f3328] line-clamp-1">{previewTitle}</h3>
            <span className="shrink-0 rounded-full bg-[#1f6f50]/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#1f6f50]">
              {previewCategory}
            </span>
          </div>
          <p className="line-clamp-2 text-[11px] leading-relaxed text-[#68766d]">
            {previewDescription}
          </p>
        </div>

        <div className="mt-3 border-t border-[#f4efe7] pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight text-[#8c755f]">
              <span>{previewLocation}</span>
              <span className="opacity-30">•</span>
              <span>{previewCondition}</span>
            </div>
            <span className="text-[10px] font-bold text-[#1f6f50]/70">By {previewOwner.split(' ')[0]}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ItemForm({
  itemForm,
  onChange,
  onSubmit,
  creatingItem,
  itemMessage,
  itemError,
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
    const { name } = event.target
    onChange(event)

    if (fieldErrors[name]) {
      setFieldErrors((current) => {
        const updated = { ...current }
        delete updated[name]
        return updated
      })
    }
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
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <form className="grid gap-6" onSubmit={handleFormSubmit} noValidate>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1f6f50]">List an Item</p>
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold tracking-tight text-[#1f3328]">
            Give with Joy
          </h2>
          <p className="text-sm leading-relaxed text-[#68766d]">
            Fill in the details below to share your item with the community.
          </p>
        </div>

        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <TextField
                id="item-owner_name"
                name="owner_name"
                label="Your Name"
                value={itemForm.owner_name}
                onChange={handleFormChange}
                placeholder="Jane Doe"
                required
              />
              <p className={`mt-1.5 text-[10px] ${fieldErrors.owner_name ? 'font-bold text-[#c65d4a]' : 'text-[#8c755f]/60'}`}>
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
                placeholder="e.g. Wooden Dining Table"
                required
              />
              <p className={`mt-1.5 text-[10px] ${fieldErrors.title ? 'font-bold text-[#c65d4a]' : 'text-[#8c755f]/60'}`}>
                {fieldErrors.title || fieldHelpText.title}
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
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
              <p className={`mt-1.5 text-[10px] ${fieldErrors.category ? 'font-bold text-[#c65d4a]' : 'text-[#8c755f]/60'}`}>
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
              <p className={`mt-1.5 text-[10px] ${fieldErrors.condition ? 'font-bold text-[#c65d4a]' : 'text-[#8c755f]/60'}`}>
                {fieldErrors.condition || fieldHelpText.condition}
              </p>
            </div>

            <div>
              <SelectField
                id="item-location"
                name="location"
                label="Location"
                value={itemForm.location}
                onChange={handleFormChange}
                options={LOCATIONS}
                placeholder="Select City"
                required
              />
              <p className={`mt-1.5 text-[10px] ${fieldErrors.location ? 'font-bold text-[#c65d4a]' : 'text-[#8c755f]/60'}`}>
                {fieldErrors.location || fieldHelpText.location}
              </p>
            </div>
          </div>

          <div>
            <TextField
              id="item-image_url"
              name="image_url"
              label="Image URL"
              value={itemForm.image_url}
              onChange={handleFormChange}
              placeholder="https://images.unsplash.com/photo..."
              required
            />
            <p className={`mt-1.5 text-[10px] ${fieldErrors.image_url ? 'font-bold text-[#c65d4a]' : 'text-[#8c755f]/60'}`}>
              {fieldErrors.image_url || fieldHelpText.image_url}
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
              rows={5}
              required
            />
            <p className={`mt-1.5 text-[10px] ${fieldErrors.description ? 'font-bold text-[#c65d4a]' : 'text-[#8c755f]/60'}`}>
              {fieldErrors.description || fieldHelpText.description}
            </p>
          </div>
        </div>

        <div className="pt-4">
          <Button
            type="submit"
            disabled={creatingItem || hasValidationErrors}
            className="h-12 w-full text-sm shadow-xl shadow-[#1f6f50]/20"
          >
            {creatingItem ? 'Publishing Listing...' : 'Publish to Community'}
          </Button>

          {itemMessage && (
            <div className="mt-4 rounded-xl bg-[#1f6f50]/5 p-3 text-center text-[11px] font-bold uppercase tracking-widest text-[#1f6f50]">
              {itemMessage}
            </div>
          )}
          {itemError && (
            <div className="mt-4 rounded-xl bg-[#c65d4a]/5 p-3 text-center text-[11px] font-bold uppercase tracking-widest text-[#c65d4a]">
              {itemError}
            </div>
          )}
        </div>
      </form>

      <div className="hidden space-y-6 lg:block">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8c755f]">Live Preview</p>
          <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-[#1f3328]">Check your listing</h3>
        </div>
        <div className="sticky top-28">
          <PreviewCard
            itemForm={itemForm}
            imageAvailable={imageAvailable}
            onImageError={() => setImageAvailable(false)}
          />
          <div className="mt-6 rounded-2xl bg-[#f4efe7]/50 p-5">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#1f3328]">Why details matter?</h4>
            <p className="mt-2 text-[11px] leading-relaxed text-[#68766d]">
              Items with clear photos and detailed descriptions are 3x more likely to find a new home quickly. Be sure to mention if any parts are missing or if there's minor wear.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
