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
