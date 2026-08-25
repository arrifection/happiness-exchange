import { useEffect, useMemo, useState } from 'react'

import { Button, SelectField, TextAreaField, TextField } from './ui.jsx'
import CitySelector from './CitySelector.jsx'
import RequesterShippingNotice, { REQUESTER_SHIPPING_NOTICE_KIND } from './RequesterShippingNotice.jsx'
import { resolveItemImageUrl, ITEM_PLACEHOLDER_URL } from '../lib/itemImages.js'
import { apiUrl } from '../lib/api.js'
import { displayTransactionCity, DEFAULT_COUNTRY } from '../lib/locations.js'

const CONDITIONS = ['New', 'Like New', 'Good', 'Gently Used', 'Used']

const STEPS = ['Choose source', 'Item details', 'Review', 'Submit']

function itemSupportsExchange(item) {
  const mode = (item?.listing_mode || 'GIVEAWAY').toUpperCase()
  return mode === 'EXCHANGE' || mode === 'BOTH'
}

export default function ProposeSwapModal({
  open,
  onClose,
  item,
  myItems = [],
  token,
  country = DEFAULT_COUNTRY,
  onSubmitted,
}) {
  const [step, setStep] = useState(0)
  const [sourceType, setSourceType] = useState('listing')
  const [offeredListingId, setOfferedListingId] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [customCondition, setCustomCondition] = useState('')
  const [customEstimatedValue, setCustomEstimatedValue] = useState('')
  const [customImageUrl, setCustomImageUrl] = useState('')
  const [message, setMessage] = useState('')
  const [cashAdjustment, setCashAdjustment] = useState('')
  const [offeringCity, setOfferingCity] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showShippingNotice, setShowShippingNotice] = useState(false)

  const availableMyItems = useMemo(
    () => (myItems || []).filter(
      (entry) => entry.id !== item?.id && entry.status === 'available',
    ),
    [myItems, item?.id],
  )

  useEffect(() => {
    if (!open) return
    setStep(0)
    setSourceType('listing')
    setOfferedListingId('')
    setCustomTitle('')
    setCustomDescription('')
    setCustomCondition('')
    setCustomEstimatedValue('')
    setCustomImageUrl('')
    setMessage('')
    setCashAdjustment('')
    setOfferingCity('')
    setError('')
    setShowShippingNotice(false)
  }, [open, item?.id])

  if (!open || !item) return null

  async function handleCustomImageUpload(event) {
    const file = event.target.files?.[0]
    if (!file || !token) return
    setUploadingImage(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(apiUrl('/api/exchange-offers/upload-image'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Image upload failed.')
      setCustomImageUrl(data.secure_url)
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setUploadingImage(false)
    }
  }

  function validateStep(currentStep) {
    if (currentStep === 0) {
      if (sourceType === 'listing' && !offeredListingId) {
        setError('Select one of your listings to offer.')
        return false
      }
      if (sourceType === 'custom') {
        if (!customTitle.trim() || !customCondition || !customImageUrl) {
          setError('Custom swap items need a title, condition, and image.')
          return false
        }
      }
    }
    if (currentStep === 1) {
      if (message.trim().length < 10) {
        setError('Please add a message of at least 10 characters.')
        return false
      }
      if (!offeringCity.trim()) {
        setError('Please select or type your city.')
        return false
      }
    }
    return true
  }

  function handleRequestSendOffer() {
    if (submitting || showShippingNotice) return
    if (!validateStep(1)) return
    setShowShippingNotice(true)
  }

  async function handleSubmit() {
    if (!validateStep(1)) return
    setShowShippingNotice(false)
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        listing_id: item.id,
        message: message.trim(),
        offering_user_city: offeringCity.trim(),
        cash_adjustment: cashAdjustment.trim() ? Number(cashAdjustment) : null,
      }
      if (sourceType === 'listing') {
        payload.offered_listing_id = offeredListingId
      } else {
        payload.custom_item_title = customTitle.trim()
        payload.custom_item_description = customDescription.trim()
        payload.custom_item_condition = customCondition
        payload.custom_item_image = customImageUrl
        if (customEstimatedValue.trim()) {
          payload.custom_item_estimated_value = Number(customEstimatedValue)
        }
      }
      const res = await fetch(apiUrl('/api/exchange-offers'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not send swap offer.')
      onSubmitted?.(data)
      onClose?.()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedListing = availableMyItems.find((entry) => entry.id === offeredListingId)

  return (
    <>
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-he-border bg-he-surface p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-he-purple">Propose a Swap</p>
            <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-he-ink">{item.title}</h2>
            <p className="text-[11px] text-he-muted">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-he-muted hover:text-he-ink">Close</button>
        </div>

        {step === 0 ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => { setSourceType('listing'); setError('') }}
                className={`rounded-xl border p-3 text-left ${sourceType === 'listing' ? 'border-he-purple bg-he-purple/5' : 'border-he-border'}`}
              >
                <p className="text-sm font-bold text-he-ink">My Existing Listing</p>
                <p className="text-[11px] text-he-muted">Offer an item you already listed.</p>
              </button>
              <button
                type="button"
                onClick={() => { setSourceType('custom'); setError('') }}
                className={`rounded-xl border p-3 text-left ${sourceType === 'custom' ? 'border-he-purple bg-he-purple/5' : 'border-he-border'}`}
              >
                <p className="text-sm font-bold text-he-ink">Upload New Item</p>
                <p className="text-[11px] text-he-muted">Private to this swap offer only.</p>
              </button>
            </div>

            {sourceType === 'listing' ? (
              <div className="space-y-2">
                {availableMyItems.length === 0 ? (
                  <p className="text-sm text-he-muted">You need an available listing to offer. Choose “Upload New Item” instead.</p>
                ) : (
                  availableMyItems.map((entry) => (
                    <label key={entry.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-he-border p-3">
                      <input
                        type="radio"
                        name="offered-listing"
                        checked={offeredListingId === entry.id}
                        onChange={() => setOfferedListingId(entry.id)}
                      />
                      <img
                        src={resolveItemImageUrl(entry.image_url)}
                        alt={entry.title}
                        className="h-12 w-12 rounded-lg object-cover"
                        onError={(event) => { event.currentTarget.src = ITEM_PLACEHOLDER_URL }}
                      />
                      <div>
                        <p className="text-sm font-bold text-he-ink">{entry.title}</p>
                        <p className="text-[11px] text-he-muted">{entry.condition}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <TextField label="Product name" value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} />
                <TextAreaField label="Description" value={customDescription} onChange={(event) => setCustomDescription(event.target.value)} rows={3} />
                <SelectField label="Condition" value={customCondition} onChange={(event) => setCustomCondition(event.target.value)}>
                  <option value="">Select condition</option>
                  {CONDITIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                </SelectField>
                <TextField label="Optional estimated value" value={customEstimatedValue} onChange={(event) => setCustomEstimatedValue(event.target.value)} />
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#a07d22]">Item image</label>
                  <input type="file" accept="image/*" onChange={handleCustomImageUpload} disabled={uploadingImage} />
                  {customImageUrl ? (
                    <img src={customImageUrl} alt="Custom swap item" className="mt-2 h-24 w-24 rounded-lg object-cover" />
                  ) : null}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <TextAreaField
              label="Message to the owner"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              placeholder="Explain why this would be a fair swap."
            />
            <TextField
              label="Optional cash adjustment"
              value={cashAdjustment}
              onChange={(event) => setCashAdjustment(event.target.value)}
              placeholder="e.g. 10 for shipping difference"
            />
            <CitySelector id="swap-offer-city" value={offeringCity} onChange={setOfferingCity} country={country} required />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3 rounded-xl border border-he-border bg-he-surface-soft p-4 text-sm">
            <p><strong>You want:</strong> {item.title}</p>
            <p><strong>You offer:</strong> {sourceType === 'listing' ? selectedListing?.title : customTitle}</p>
            {cashAdjustment ? <p><strong>Cash adjustment:</strong> {cashAdjustment}</p> : null}
            <p><strong>Your city:</strong> {displayTransactionCity(offeringCity)}</p>
            <p><strong>Message:</strong> {message}</p>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm font-bold text-he-danger">{error}</p> : null}

        <div className="mt-5 flex flex-wrap justify-between gap-2">
          <Button variant="ghost" onClick={() => (step === 0 ? onClose() : setStep((current) => current - 1))}>
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < 2 ? (
            <Button
              onClick={() => {
                if (validateStep(step)) {
                  setError('')
                  setStep((current) => current + 1)
                }
              }}
            >
              Continue
            </Button>
          ) : (
            <Button disabled={submitting || !offeringCity} onClick={handleRequestSendOffer}>
              {submitting ? 'Sending…' : 'Send Swap Offer'}
            </Button>
          )}
        </div>
      </div>
    </div>
    <RequesterShippingNotice
      open={showShippingNotice}
      kind={REQUESTER_SHIPPING_NOTICE_KIND.exchange}
      confirming={submitting}
      onCancel={() => setShowShippingNotice(false)}
      onConfirm={handleSubmit}
    />
    </>
  )
}

export { itemSupportsExchange }
