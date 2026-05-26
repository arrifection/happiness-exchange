import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'

import MapRecenter from './MapRecenter.jsx'
import { resolveMapCenter } from '../../lib/locations.js'
import { pickerLocationIcon, userLocationIcon } from '../../lib/leafletSetup.js'
import '../../lib/leafletSetup.js'

function MapClickHandler({ onPick, disabled }) {
  useMapEvents({
    click(event) {
      if (disabled) return
      onPick(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

export default function LocationMapPicker({
  country,
  city,
  latitude = null,
  longitude = null,
  showUserLocation = false,
  userLatitude = null,
  userLongitude = null,
  locationSource = 'manual',
  onPick,
  disabled = false,
}) {
  const [mounted, setMounted] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const mapView = useMemo(
    () => resolveMapCenter({
      country,
      city,
      latitude: latitude ?? (showUserLocation ? userLatitude : null),
      longitude: longitude ?? (showUserLocation ? userLongitude : null),
    }),
    [country, city, latitude, longitude, showUserLocation, userLatitude, userLongitude],
  )

  if (!mounted) {
    return null
  }

  const mapPanel = (
    <div className="overflow-hidden rounded-2xl border border-he-border bg-he-surface">
      <div className="h-[200px] md:h-[240px]">
        <MapContainer
          center={mapView.center}
          zoom={mapView.zoom}
          scrollWheelZoom={false}
          className="h-full w-full"
          aria-label="Pickup location map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapRecenter center={mapView.center} zoom={mapView.zoom} />
          <MapClickHandler
            disabled={disabled}
            onPick={(lat, lng) => onPick?.({ latitude: lat, longitude: lng, locationSource: 'manual' })}
          />

          {showUserLocation && userLatitude != null && userLongitude != null ? (
            <Marker position={[userLatitude, userLongitude]} icon={userLocationIcon}>
              <Popup>Your location</Popup>
            </Marker>
          ) : null}

          {latitude != null && longitude != null && locationSource !== 'current_location' ? (
            <Marker position={[latitude, longitude]} icon={pickerLocationIcon}>
              <Popup>Selected pickup point</Popup>
            </Marker>
          ) : null}
        </MapContainer>
      </div>
      <p className="border-t border-he-border/60 px-3 py-2 text-[10px] text-he-muted">
        Tap the map to set an approximate pickup point. Exact addresses stay private.
      </p>
    </div>
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-he-muted">Map picker (optional)</p>
        <button
          type="button"
          onClick={() => setMapOpen((open) => !open)}
          className="text-[10px] font-bold uppercase tracking-widest text-he-purple md:hidden"
        >
          {mapOpen ? 'Hide map' : 'Show map'}
        </button>
      </div>
      <div className="hidden md:block">{mapPanel}</div>
      {mapOpen ? <div className="md:hidden">{mapPanel}</div> : null}
    </div>
  )
}
