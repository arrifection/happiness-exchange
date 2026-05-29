import { useCallback, useEffect, useState } from 'react'

import { SelectField, TextField } from './ui.jsx'
import LocationMapPicker from './map/LocationMapPicker.jsx'
import {
  COUNTRIES,
  buildLocationDisplay,
  getCitiesForCountry,
  getCityCoordinates,
} from '../lib/locations.js'

export default function LocationSelector({
  country,
  city,
  area = '',
  latitude = null,
  longitude = null,
  locationSource = 'manual',
  onChange,
  showArea = false,
  showCurrentLocation = true,
  showMapPicker = false,
  defaultMapOpen = false,
  disabled = false,
  locationRequired = true,
}) {
  const [geoMessage, setGeoMessage] = useState('')
  const [geoError, setGeoError] = useState('')
  const [locating, setLocating] = useState(false)

  const cities = getCitiesForCountry(country)

  useEffect(() => {
    if (city && cities.length > 0 && !cities.includes(city)) {
      onChange({
        country,
        city: '',
        area,
        latitude,
        longitude,
        location_source: locationSource,
        location: '',
        location_display: buildLocationDisplay({ country, city: '', area, locationSource }),
      })
    }
  }, [country])

  function coordsForCity(nextCountry, nextCity) {
    const coords = getCityCoordinates(nextCountry, nextCity)
    if (!coords) {
      return { latitude: null, longitude: null }
    }
    return { latitude: coords[0], longitude: coords[1] }
  }

  function emit(next) {
    const resolvedCity = next.city ?? city
    const resolvedCountry = next.country ?? country
    const resolvedArea = next.area ?? area
    const resolvedSource = next.location_source ?? locationSource
    let resolvedLat = next.latitude !== undefined ? next.latitude : latitude
    let resolvedLng = next.longitude !== undefined ? next.longitude : longitude

    if (next.city !== undefined && next.latitude === undefined && next.longitude === undefined) {
      const cityCoords = coordsForCity(resolvedCountry, resolvedCity)
      resolvedLat = cityCoords.latitude
      resolvedLng = cityCoords.longitude
    }

    const locationDisplay = buildLocationDisplay({
      country: resolvedCountry,
      city: resolvedCity,
      area: resolvedArea,
      locationSource: resolvedSource,
    })
    onChange({
      country: resolvedCountry,
      city: resolvedCity,
      area: resolvedArea,
      latitude: resolvedLat,
      longitude: resolvedLng,
      location_source: resolvedSource,
      location: resolvedCity || locationDisplay,
      location_display: locationDisplay,
    })
  }

  const handleUseCurrentLocation = useCallback(() => {
    setGeoMessage('')
    setGeoError('')
    if (!navigator.geolocation) {
      setGeoError('Location is not supported in this browser. Please select country and city manually.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        setGeoMessage('Current location selected')
        emit({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          location_source: 'current_location',
        })
      },
      () => {
        setLocating(false)
        setGeoError('Location permission denied. Pick a city or tap the map to set an approximate pickup point.')
        emit({ location_source: 'manual', latitude: null, longitude: null })
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    )
  }, [country, city, area, latitude, longitude, locationSource])

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id="location-country"
          name="country"
          label="Country"
          value={country}
          onChange={(event) => emit({ country: event.target.value, city: '', location_source: 'manual', latitude: null, longitude: null })}
          options={COUNTRIES}
          required={locationRequired}
          disabled={disabled}
        />
        <SelectField
          id="location-city"
          name="city"
          label="City"
          value={city}
          onChange={(event) => emit({ city: event.target.value, location_source: 'manual' })}
          options={cities}
          placeholder="Select city"
          required={locationRequired}
          disabled={disabled || !country}
        />
      </div>

      {showArea ? (
        <TextField
          id="location-area"
          name="area"
          label="Area (optional)"
          value={area}
          onChange={(event) => emit({ area: event.target.value, location_source: 'manual' })}
          placeholder="Neighborhood or area"
          disabled={disabled}
        />
      ) : null}

      {showCurrentLocation ? (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={disabled || locating}
            className="inline-flex min-h-9 items-center justify-center rounded-btn border border-he-border bg-he-surface px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-he-purple transition hover:border-he-purple/40 hover:bg-he-surface-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {locating ? 'Getting location…' : 'Use current location'}
          </button>
          {locationSource === 'current_location' && latitude != null && longitude != null ? (
            <p className="text-[10px] font-medium text-he-success">Current location selected</p>
          ) : null}
          {geoMessage ? <p className="text-[10px] font-medium text-he-success">{geoMessage}</p> : null}
          {geoError ? <p className="text-[10px] font-medium text-he-danger">{geoError}</p> : null}
        </div>
      ) : null}

      {showMapPicker ? (
        <LocationMapPicker
          country={country}
          city={city}
          latitude={latitude}
          longitude={longitude}
          showUserLocation={locationSource === 'current_location'}
          userLatitude={latitude}
          userLongitude={longitude}
          locationSource={locationSource}
          disabled={disabled}
          defaultMapOpen={defaultMapOpen}
          onPick={(picked) => emit({
            latitude: picked.latitude,
            longitude: picked.longitude,
            location_source: 'manual',
          })}
        />
      ) : null}
    </div>
  )
}
