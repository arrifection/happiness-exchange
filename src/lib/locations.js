export const LOCATION_PREF_KEY = 'happiness_exchange_location_prefs'

export const COUNTRIES = ['Pakistan', 'Saudi Arabia']

export const CITIES_BY_COUNTRY = {
  Pakistan: [
    'Lahore',
    'Islamabad',
    'Karachi',
    'Rawalpindi',
    'Faisalabad',
    'Multan',
    'Gujrat',
    'Mandi Bahauddin',
  ],
  'Saudi Arabia': [
    'Riyadh',
    'Jeddah',
    'Makkah',
    'Madinah',
    'Dammam',
    'Khobar',
    'Taif',
  ],
}

export const DEFAULT_COUNTRY = 'Pakistan'

export const COUNTRY_MAP_VIEW = {
  Pakistan: { center: [30.3753, 69.3451], zoom: 5 },
  'Saudi Arabia': { center: [23.8859, 45.0792], zoom: 5 },
}

export const CITY_COORDINATES = {
  Pakistan: {
    Lahore: [31.5497, 74.3436],
    Islamabad: [33.6844, 73.0479],
    Karachi: [24.8607, 67.0011],
    Rawalpindi: [33.5651, 73.0169],
    Faisalabad: [31.4504, 73.135],
    Multan: [30.1575, 71.5249],
    Gujrat: [32.5742, 74.0754],
    'Mandi Bahauddin': [32.587, 73.491],
  },
  'Saudi Arabia': {
    Riyadh: [24.7136, 46.6753],
    Jeddah: [21.4858, 39.1925],
    Makkah: [21.3891, 39.8579],
    Madinah: [24.5247, 39.5692],
    Dammam: [26.3927, 49.9777],
    Khobar: [26.2172, 50.1971],
    Taif: [21.4373, 40.5127],
  },
}

export function getCountryMapView(country) {
  return COUNTRY_MAP_VIEW[country] || COUNTRY_MAP_VIEW[DEFAULT_COUNTRY]
}

export function getCityCoordinates(country, city) {
  if (!country || !city) return null
  return CITY_COORDINATES[country]?.[city] || null
}

export function resolveMapCenter({ country, city, latitude, longitude }) {
  if (latitude != null && longitude != null) {
    return { center: [latitude, longitude], zoom: city ? 12 : 10 }
  }
  const cityCoords = getCityCoordinates(country, city)
  if (cityCoords) {
    return { center: cityCoords, zoom: 11 }
  }
  return getCountryMapView(country)
}

export function getItemMapPosition(item) {
  if (item?.latitude != null && item?.longitude != null) {
    return [Number(item.latitude), Number(item.longitude)]
  }
  return null
}

export function getPublicLocationLabel(item) {
  return item?.location_display || item?.city || item?.location || 'Location unavailable'
}

export function getCitiesForCountry(country) {
  return CITIES_BY_COUNTRY[country] || []
}

export function buildLocationDisplay({
  country,
  city,
  area,
  locationSource = 'manual',
}) {
  if (locationSource === 'current_location') {
    if (city && country) return `Current location · ${city}, ${country}`
    return 'Current location selected'
  }
  const parts = [area, city, country].filter(Boolean)
  return parts.join(', ')
}

export function readLocationPreferences() {
  try {
    const raw = localStorage.getItem(LOCATION_PREF_KEY)
    if (!raw) {
      return {
        country: DEFAULT_COUNTRY,
        city: '',
        area: '',
        latitude: null,
        longitude: null,
        locationSource: 'manual',
      }
    }
    const parsed = JSON.parse(raw)
    return {
      country: COUNTRIES.includes(parsed.country) ? parsed.country : DEFAULT_COUNTRY,
      city: parsed.city || '',
      area: parsed.area || '',
      latitude: typeof parsed.latitude === 'number' ? parsed.latitude : null,
      longitude: typeof parsed.longitude === 'number' ? parsed.longitude : null,
      locationSource: parsed.locationSource === 'current_location' ? 'current_location' : 'manual',
    }
  } catch {
    return {
      country: DEFAULT_COUNTRY,
      city: '',
      area: '',
      latitude: null,
      longitude: null,
      locationSource: 'manual',
    }
  }
}

export function writeLocationPreferences(prefs) {
  try {
    localStorage.setItem(LOCATION_PREF_KEY, JSON.stringify(prefs))
  } catch {
    /* private browsing */
  }
}

export function buildItemsQueryParams(prefs) {
  const params = new URLSearchParams()
  if (prefs?.country) params.set('country', prefs.country)
  if (prefs?.city) params.set('city', prefs.city)
  if (prefs?.locationSource === 'current_location' && prefs.latitude != null && prefs.longitude != null) {
    params.set('near_lat', String(prefs.latitude))
    params.set('near_lng', String(prefs.longitude))
    params.set('radius_km', '50')
  }
  return params
}
