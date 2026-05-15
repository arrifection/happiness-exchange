import { useEffect, useMemo, useState } from 'react'

import { Button, TextAreaField, TextField } from './ui.jsx'

const fieldHelpText = {
  title: 'Choose a clear everyday title so people understand the item quickly.',
  description: 'Mention size, condition, pickup expectations, and anything a nearby family should know.',
  category: 'A simple category like Furniture, Baby, Kitchen, or Books works well.',
  condition: 'Be honest and kind here. Clear condition details help build trust.',
  location: 'Use the neighborhood or city area where the item can be picked up.',
  image_url: 'Paste a direct image URL if you have one. Real uploads can come later.',
}

function helperMessage(fieldName, errorMessage) {
  return errorMessage || fieldHelpText[fieldName]
}

function validateItemForm(itemForm) {
  const errors = {}

  if (!itemForm.title.trim()) {
    errors.title = 'Please add a title.'
  }

  if (!itemForm.description.trim()) {
    errors.description = 'Please describe the item.'
  }

  if (!itemForm.category.trim()) {
    errors.category = 'Please choose a category.'
  }

  if (!itemForm.condition.trim()) {
    errors.condition = 'Please share the item condition.'
  }

  if (!itemForm.location.trim()) {
    errors.location = 'Please add a pickup location.'
  }

  if (itemForm.image_url.trim()) {
    try {
      // Validate early so we can show a friendly message before submit.
      new URL(itemForm.image_url.trim())
    } catch {
      errors.image_url = 'Please enter a valid image URL.'
    }
  }

  return errors
}

function PreviewCard({ itemForm, imageAvailable, onImageError }) {
  const previewTitle = itemForm.title.trim() || 'Your item preview'
  const previewDescription = itemForm.description.trim() || 'A helpful listing preview will appear here as you type.'
  const previewCategory = itemForm.category.trim() || 'Category'
  const previewCondition = itemForm.condition.trim() || 'Condition'
  const previewLocation = itemForm.location.trim() || 'Location'

  return (
    <div className="overflow-hidden rounded-[30px] border border-white/75 bg-white/84 shadow-[0_18px_50px_rgba(29,33,44,0.08)] backdrop-blur">
      <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(135deg,rgba(141,189,167,0.9),rgba(243,191,168,0.88))]">
        {itemForm.image_url.trim() && imageAvailable ? (
          <>
            <img
              src={itemForm.image_url.trim()}
              alt={previewTitle}
              className="h-full w-full object-cover"
              onError={onImageError}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(32,53,46,0.54)_100%)]" />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center text-white">
            <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur">
              <div className="h-10 w-10 rounded-2xl border border-white/60 bg-white/82" />
            </div>
            <h3 className="mt-5 font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-xl font-semibold">
              Shared with care
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/84">
              If no image is available, your listing still feels warm and polished to the community.
            </p>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <span className="rounded-full bg-white/82 px-3 py-1 text-xs font-semibold text-[#466359] shadow-sm">
            {previewCategory}
          </span>
          <span className="rounded-full bg-white/88 px-3 py-1 text-xs font-semibold capitalize text-[#7b6d60] shadow-sm">
            Preview
          </span>
        </div>
      </div>

      <div className="space-y-4 p-6">
        <div>
          <h3 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-2xl font-semibold tracking-[-0.04em] text-[#20352e]">
            {previewTitle}
          </h3>
          <p className="mt-3 text-sm leading-7 text-[#64736e]">{previewDescription}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#f3efe7] px-3 py-1.5 text-xs font-medium text-[#4f615b]">
            {previewCondition}
          </span>
          <span className="rounded-full bg-[#eef6f1] px-3 py-1.5 text-xs font-medium text-[#447261]">
            {previewLocation}
          </span>
          <span className="rounded-full bg-[#fff2ea] px-3 py-1.5 text-xs font-medium text-[#b06144]">
            Ready to publish
          </span>
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
  const [imageAvailable, setImageAvailable] = useState(Boolean(itemForm.image_url.trim()))

  useEffect(() => {
    setImageAvailable(Boolean(itemForm.image_url.trim()))
  }, [itemForm.image_url])

  const hasValidationErrors = useMemo(
    () => Object.keys(fieldErrors).length > 0,
    [fieldErrors],
  )

  function handleFormChange(event) {
    const { name } = event.target
    onChange(event)

    setFieldErrors((current) => {
      if (!current[name]) {
        return current
      }

      const updated = { ...current }
      delete updated[name]
      return updated
    })
  }

  async function handleFormSubmit(event) {
    const nextErrors = validateItemForm(itemForm)

    if (Object.keys(nextErrors).length > 0) {
      event.preventDefault()
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})
    await onSubmit(event)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <form className="grid gap-6" onSubmit={handleFormSubmit} noValidate>
        <div className="max-w-2xl">
          <p className="inline-flex rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b35d3c]">
            Share a listing
          </p>
          <h2 className="mt-4 font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-3xl font-semibold tracking-[-0.04em] text-[#20352e]">
            Tell the community what you&apos;re passing along
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#65736e]">
            Keep it clear, warm, and honest so someone nearby can quickly tell whether it is the right fit.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <TextField
              id="item-title"
              name="title"
              label="Title"
              value={itemForm.title}
              onChange={handleFormChange}
              placeholder="Wooden study table"
              required
            />
            <p className={`mt-2 text-sm ${fieldErrors.title ? 'font-medium text-[#b04e43]' : 'text-[#6a7773]'}`}>
              {helperMessage('title', fieldErrors.title)}
            </p>
          </div>

          <div>
            <TextField
              id="item-category"
              name="category"
              label="Category"
              value={itemForm.category}
              onChange={handleFormChange}
              placeholder="Furniture"
              required
            />
            <p className={`mt-2 text-sm ${fieldErrors.category ? 'font-medium text-[#b04e43]' : 'text-[#6a7773]'}`}>
              {helperMessage('category', fieldErrors.category)}
            </p>
          </div>

          <div className="lg:col-span-2">
            <TextAreaField
              id="item-description"
              name="description"
              label="Description"
              value={itemForm.description}
              onChange={handleFormChange}
              placeholder="Describe the size, condition, pickup expectations, and anything helpful to know."
              rows={5}
              required
            />
            <p className={`mt-2 text-sm ${fieldErrors.description ? 'font-medium text-[#b04e43]' : 'text-[#6a7773]'}`}>
              {helperMessage('description', fieldErrors.description)}
            </p>
          </div>

          <div>
            <TextField
              id="item-condition"
              name="condition"
              label="Condition"
              value={itemForm.condition}
              onChange={handleFormChange}
              placeholder="Gently used"
              required
            />
            <p className={`mt-2 text-sm ${fieldErrors.condition ? 'font-medium text-[#b04e43]' : 'text-[#6a7773]'}`}>
              {helperMessage('condition', fieldErrors.condition)}
            </p>
          </div>

          <div>
            <TextField
              id="item-location"
              name="location"
              label="Location"
              value={itemForm.location}
              onChange={handleFormChange}
              placeholder="Lahore"
              required
            />
            <p className={`mt-2 text-sm ${fieldErrors.location ? 'font-medium text-[#b04e43]' : 'text-[#6a7773]'}`}>
              {helperMessage('location', fieldErrors.location)}
            </p>
          </div>

          <div className="lg:col-span-2">
            <TextField
              id="item-image-url"
              name="image_url"
              label="Image URL"
              value={itemForm.image_url}
              onChange={handleFormChange}
              placeholder="https://example.com/item.jpg"
            />
            <p className={`mt-2 text-sm ${fieldErrors.image_url ? 'font-medium text-[#b04e43]' : 'text-[#6a7773]'}`}>
              {helperMessage('image_url', fieldErrors.image_url)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[28px] border border-[#f0e8dc] bg-[#fff9f3] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-[#29413b]">Listings stay free and community-first.</p>
            <p className="mt-1 text-sm text-[#6a7773]">
              Someone nearby may truly need what you no longer use, so a clear listing can make the handoff easier.
            </p>
          </div>
          <Button type="submit" className="sm:min-w-44" disabled={creatingItem || hasValidationErrors}>
            {creatingItem ? 'Publishing Item...' : 'Publish Item'}
          </Button>
        </div>

        {itemMessage ? <p className="text-sm font-medium text-[#1d6b57]">{itemMessage}</p> : null}
        {itemError ? <p className="text-sm font-medium text-[#b04e43]">{itemError}</p> : null}
      </form>

      <div className="space-y-5">
        <div className="rounded-[28px] border border-white/70 bg-white/72 p-5 shadow-[0_18px_40px_rgba(35,39,46,0.07)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b35d3c]">Preview</p>
          <h3 className="mt-3 font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-2xl font-semibold tracking-[-0.04em] text-[#20352e]">
            See how your item will appear
          </h3>
          <p className="mt-2 text-sm leading-7 text-[#65736e]">
            A calm, readable preview helps you catch anything missing before you publish.
          </p>
        </div>

        <PreviewCard
          itemForm={itemForm}
          imageAvailable={imageAvailable}
          onImageError={() => setImageAvailable(false)}
        />
      </div>
    </div>
  )
}
