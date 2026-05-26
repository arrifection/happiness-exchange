import { useCallback, useEffect, useState } from 'react'

import { SelectField, TextField } from './ui.jsx'
import LocationMapPicker from './map/LocationMapPicker.jsx'
import {
  COUNTRIES,
  buildLocationDisplay,
  getCitiesForCountry,
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
  disabled = false,
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
        locationSource,
        location: '',
        location_display: buildLocationDisplay({ country, city: '', area, locationSource }),
      })
    }
  }, [country])

  function emit(next) {
    const resolvedCity = next.city ?? city
    const resolvedCountry = next.country ?? country
    const resolvedArea = next.area ?? area
    const resolvedSource = next.locationSource ?? locationSource
    const resolvedLat = next.latitude !== undefined ? next.latitude : latitude
    const resolvedLng = next.longitude !== undefined ? next.longitude : longitude
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
      locationSource: resolvedSource,
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
          locationSource: 'current_location',
        })
      },
      () => {
        setLocating(false)
        setGeoError('Location permission denied. Please select country and city manually.')
        emit({ locationSource: 'manual', latitude: null, longitude: null })
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
          onChange={(event) => emit({ country: event.target.value, city: '', locationSource: 'manual', latitude: null, longitude: null })}
          options={COUNTRIES}
          required
          disabled={disabled}
        />
        <SelectField
          id="location-city"
          name="city"
          label="City"
          value={city}
          onChange={(event) => emit({ city: event.target.value, locationSource: 'manual', latitude: null, longitude: null })}
          options={cities}
          placeholder="Select city"
          required
          disabled={disabled || !country}
        />
      </div>

      {showArea ? (
        <TextField
          id="location-area"
          name="area"
          label="Area (optional)"
          value={area}
          onChange={(event) => emit({ area: event.target.value, locationSource: 'manual', latitude: null, longitude: null })}
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
          onPick={(picked) => emit({
            latitude: picked.latitude,
            longitude: picked.longitude,
            locationSource: 'manual',
          })}
        />
      ) : null}
    </div>
  )
}
