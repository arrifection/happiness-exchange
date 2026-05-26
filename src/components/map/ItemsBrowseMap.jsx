import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'

import MapRecenter from './MapRecenter.jsx'
import { Button } from '../ui.jsx'
import { getItemMapPosition, getPublicLocationLabel, resolveMapCenter } from '../../lib/locations.js'
import { userLocationIcon } from '../../lib/leafletSetup.js'
import '../../lib/leafletSetup.js'

export default function ItemsBrowseMap({
  items = [],
  country,
  city,
  userLatitude = null,
  userLongitude = null,
  showUserLocation = false,
  defaultOpen = false,
}) {
  const [mounted, setMounted] = useState(false)
  const [mapOpen, setMapOpen] = useState(defaultOpen)

  useEffect(() => {
    setMounted(true)
  }, [])

  const mappableItems = useMemo(
    () => items.filter((item) => getItemMapPosition(item)),
    [items],
  )

  const mapView = useMemo(
    () => resolveMapCenter({
      country,
      city,
      latitude: showUserLocation ? userLatitude : null,
      longitude: showUserLocation ? userLongitude : null,
    }),
    [country, city, showUserLocation, userLatitude, userLongitude],
  )

  if (!mounted) {
    return null
  }

  const mapPanel = (
    <div className="overflow-hidden rounded-2xl border border-he-border bg-he-surface">
      <div className="h-[220px] md:h-[320px]">
        <MapContainer
          center={mapView.center}
          zoom={mapView.zoom}
          scrollWheelZoom={false}
          className="h-full w-full"
          aria-label={`Map of listings in ${country}`}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapRecenter center={mapView.center} zoom={mapView.zoom} />

          {showUserLocation && userLatitude != null && userLongitude != null ? (
            <Marker position={[userLatitude, userLongitude]} icon={userLocationIcon}>
              <Popup>Your location</Popup>
            </Marker>
          ) : null}

          {mappableItems.map((item) => {
            const position = getItemMapPosition(item)
            if (!position) return null
            return (
              <Marker key={item.id} position={position}>
                <Popup>
                  <div className="min-w-[160px] space-y-2">
                    <p className="text-sm font-bold text-he-ink">{item.title}</p>
                    <p className="text-[11px] text-he-muted">{getPublicLocationLabel(item)}</p>
                    <Button as="link" to={`/items/${item.id}`} className="h-8 min-h-0 w-full text-[10px]">
                      View item
                    </Button>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
      <div className="border-t border-he-border/60 px-3 py-2 text-[10px] text-he-muted">
        {mappableItems.length === 0
          ? 'No listings found in this area.'
          : `${mappableItems.length} listing${mappableItems.length === 1 ? '' : 's'} on map · city/area shown only`}
      </div>
    </div>
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 md:hidden">
        <p className="text-[10px] font-bold uppercase tracking-widest text-he-muted">Map view</p>
        <button
          type="button"
          onClick={() => setMapOpen((open) => !open)}
          className="text-[10px] font-bold uppercase tracking-widest text-he-purple"
        >
          {mapOpen ? 'Hide map' : 'Show map'}
        </button>
      </div>
      <div className="hidden md:block">{mapPanel}</div>
      {mapOpen ? <div className="md:hidden">{mapPanel}</div> : null}
    </div>
  )
}
