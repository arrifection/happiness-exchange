import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'

import MapRecenter from './MapRecenter.jsx'
import { getItemMapPosition, getPublicLocationLabel, resolveMapCenter } from '../../lib/locations.js'
import { pickerLocationIcon } from '../../lib/leafletSetup.js'
import '../../lib/leafletSetup.js'

export default function ItemLocationMapModal({ open, item, onClose }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  const position = useMemo(() => getItemMapPosition(item), [item])
  const mapView = useMemo(
    () => resolveMapCenter({
      country: item?.country,
      city: item?.city || item?.location,
      latitude: position?.[0] ?? null,
      longitude: position?.[1] ?? null,
    }),
    [item?.country, item?.city, item?.location, position],
  )

  if (!open || !mounted) return null

  const label = getPublicLocationLabel(item)

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-t-3xl border border-he-border bg-he-surface shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Map for ${label}`}
      >
        <div className="flex items-center justify-between border-b border-he-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-he-soft">Pickup area</p>
            <p className="truncate text-sm font-bold text-he-ink">{label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-he-border bg-he-surface-soft text-he-soft transition hover:text-he-ink"
            aria-label="Close map"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="h-[240px] sm:h-[280px]">
          <MapContainer
            center={mapView.center}
            zoom={mapView.zoom}
            scrollWheelZoom={false}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapRecenter center={mapView.center} zoom={mapView.zoom} />
            {position ? (
              <Marker position={position} icon={pickerLocationIcon}>
              </Marker>
            ) : null}
          </MapContainer>
        </div>

        <p className="border-t border-he-border/60 px-4 py-3 text-[11px] leading-relaxed text-he-muted">
          Approximate city-level location only. Exact addresses are never shown.
        </p>
      </div>
    </div>
  )
}
