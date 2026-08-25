import { useEffect, useMemo, useRef, useState } from 'react'

import {
  DEFAULT_COUNTRY,
  getTransactionCitiesForCountry,
  isKnownTransactionCity,
  normalizeCountryName,
} from '../lib/locations.js'

export default function CitySelector({
  id = 'your-city',
  value = '',
  onChange,
  country: countryProp = DEFAULT_COUNTRY,
  required = true,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const country = normalizeCountryName(countryProp)
  const cities = getTransactionCitiesForCountry(country)
  const typed = String(value || '')
  const matches = useMemo(() => {
    const query = typed.trim().toLowerCase()
    if (!query) return cities
    return cities.filter((city) => city.toLowerCase().includes(query))
  }, [cities, typed])
  const exactMatch = isKnownTransactionCity(typed, country)

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function chooseCity(city) {
    onChange?.(city)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="space-y-3">
      <label className="grid gap-1.5" htmlFor={id}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22] dark:text-he-yellow">
          Your city
        </span>
        <input
          id={id}
          name="city"
          type="text"
          value={typed}
          disabled={disabled}
          required={required}
          autoComplete="off"
          placeholder={country === 'Saudi Arabia' ? 'Search or type, e.g. Riyadh' : 'Search or type, e.g. Lahore'}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange?.(event.target.value)
            setOpen(true)
          }}
          className="min-h-10 rounded-input border border-he-border bg-he-input px-3 text-sm text-he-ink outline-none transition placeholder:text-he-soft/60 focus:border-he-purple focus:ring-2 focus:ring-he-purple/10 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>
      <p className="text-[11px] leading-relaxed text-he-muted">
        Showing {country} cities from your account. Type to search, or type a city that is not listed.
      </p>
      {open && !disabled ? (
        <ul className="max-h-56 overflow-auto rounded-xl border border-he-border bg-he-surface p-1 shadow-lg">
          {matches.map((city) => (
            <li key={city}>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-he-ink hover:bg-he-surface-soft"
                onMouseDown={(event) => {
                  event.preventDefault()
                  chooseCity(city)
                }}
              >
                {city}
              </button>
            </li>
          ))}
          {typed.trim() && !exactMatch ? (
            <li>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-he-purple hover:bg-[#efe7ff]"
                onMouseDown={(event) => {
                  event.preventDefault()
                  chooseCity(typed.trim())
                }}
              >
                Use “{typed.trim()}”
              </button>
            </li>
          ) : null}
          {matches.length === 0 && !typed.trim() ? (
            <li className="px-3 py-2 text-sm text-he-muted">Start typing to find a city.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
