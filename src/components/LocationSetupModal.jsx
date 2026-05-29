import { useEffect, useState } from 'react'

import LocationSelector from './LocationSelector.jsx'
import { Button } from './ui.jsx'
import { buildLocationDisplay } from '../lib/locations.js'

function toDraft(prefs) {
  return {
    country: prefs?.country || 'Pakistan',
    city: prefs?.city || '',
    area: prefs?.area || '',
    latitude: prefs?.latitude ?? null,
    longitude: prefs?.longitude ?? null,
    locationSource: prefs?.locationSource || prefs?.location_source || 'manual',
  }
}

export default function LocationSetupModal({ open, initialPrefs, onSave, onClose }) {
  const [draft, setDraft] = useState(() => toDraft(initialPrefs))

  useEffect(() => {
    if (open) {
      setDraft(toDraft(initialPrefs))
    }
  }, [open, initialPrefs])

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  function handleSelectorChange(values) {
    setDraft({
      country: values.country,
      city: values.city || '',
      area: values.area || '',
      latitude: values.latitude ?? null,
      longitude: values.longitude ?? null,
      locationSource: values.location_source || values.locationSource || 'manual',
    })
  }

  function handleSave() {
    if (!draft.country || !draft.city) return
    onSave?.({
      country: draft.country,
      city: draft.city,
      area: draft.area,
      latitude: draft.latitude,
      longitude: draft.longitude,
      locationSource: draft.locationSource,
      location_display: buildLocationDisplay({
        country: draft.country,
        city: draft.city,
        area: draft.area,
        locationSource: draft.locationSource,
      }),
    })
    onClose?.()
  }

  const canSave = Boolean(draft.country && draft.city)

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-he-border bg-he-surface shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-setup-title"
      >
        <div className="border-b border-he-border px-5 py-4">
          <h2 id="location-setup-title" className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-he-ink">
            Set your location
          </h2>
          <p className="mt-1 text-xs text-he-muted">
            We use this to show items near you. Your exact address is never shared.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <LocationSelector
            country={draft.country}
            city={draft.city}
            area={draft.area}
            latitude={draft.latitude}
            longitude={draft.longitude}
            locationSource={draft.locationSource}
            onChange={handleSelectorChange}
            showArea={false}
            showCurrentLocation
            showMapPicker={false}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-he-border bg-he-surface-soft px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" className="min-h-10" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" className="min-h-10" disabled={!canSave} onClick={handleSave}>
            Save location
          </Button>
        </div>
      </div>
    </div>
  )
}
