import { useEffect, useState } from 'react'

import LocationSelector from './LocationSelector.jsx'
import LocationMapPicker from './map/LocationMapPicker.jsx'
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

export function hasGiveItemLocation(form) {
  return Boolean(
    form?.city?.trim()
    || form?.location?.trim()
    || form?.location_display?.trim()
    || (form?.latitude != null && form?.longitude != null),
  )
}

export default function GiveItemLocationModal({ open, initialValues, onSave, onClose }) {
  const [draft, setDraft] = useState(() => toDraft(initialValues))
  const [mapOpen, setMapOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(toDraft(initialValues))
      setMapOpen(false)
    }
  }, [open, initialValues])

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
    const locationDisplay = buildLocationDisplay({
      country: draft.country,
      city: draft.city,
      area: draft.area,
      locationSource: draft.locationSource,
    })
    onSave?.({
      country: draft.country,
      city: draft.city,
      area: draft.area,
      latitude: draft.latitude,
      longitude: draft.longitude,
      location_source: draft.locationSource,
      location: draft.city || locationDisplay,
      location_display: locationDisplay,
    })
    onClose?.()
  }

  function handleClear() {
    onSave?.({
      country: draft.country,
      city: '',
      area: '',
      latitude: null,
      longitude: null,
      location_source: 'manual',
      location: '',
      location_display: '',
    })
    onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-he-border bg-he-surface shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="give-location-title"
      >
        <div className="shrink-0 border-b border-he-border px-5 py-4">
          <h2 id="give-location-title" className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-he-ink">
            Pickup location
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-he-muted">
            Exact address stays private. Add only an approximate pickup area.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
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
            locationRequired={false}
          />

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setMapOpen((open) => !open)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-he-border bg-he-surface-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-he-purple transition hover:border-he-purple/30"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20 3 12l6-8 6 8-6 8Zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
              </svg>
              {mapOpen ? 'Hide map' : 'Set approximate pickup point'}
            </button>
            {mapOpen ? (
              <LocationMapPicker
                country={draft.country}
                city={draft.city}
                latitude={draft.latitude}
                longitude={draft.longitude}
                showUserLocation={draft.locationSource === 'current_location'}
                userLatitude={draft.latitude}
                userLongitude={draft.longitude}
                locationSource={draft.locationSource}
                defaultMapOpen
                embedded
                onPick={(picked) => handleSelectorChange({
                  country: draft.country,
                  city: draft.city,
                  area: draft.area,
                  latitude: picked.latitude,
                  longitude: picked.longitude,
                  location_source: 'manual',
                })}
              />
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-he-border bg-he-surface-soft px-5 py-4 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" className="min-h-10 sm:mr-auto" onClick={handleClear}>
            Clear location
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="ghost" className="min-h-10" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="primary" className="min-h-10" onClick={handleSave}>
              Save location
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
