import { buildLocationDisplay } from '../lib/locations.js'

function PinIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.5 7-10a7 7 0 1 0-14 0c0 5.5 7 10 7 10Z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  )
}

export default function BrowseLocationPill({ locationPrefs, onOpenSetup }) {
  const hasCity = Boolean(locationPrefs?.city)
  const summary = buildLocationDisplay({
    country: locationPrefs?.country,
    city: locationPrefs?.city,
    area: locationPrefs?.area,
    locationSource: locationPrefs?.locationSource,
  })

  if (!hasCity) {
    return (
      <button
        type="button"
        onClick={onOpenSetup}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-he-purple/25 bg-he-purple/8 px-3 py-1.5 text-[11px] font-bold text-he-purple transition hover:border-he-purple/40 hover:bg-he-purple/12"
      >
        <PinIcon />
        Set Location
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpenSetup}
      className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border border-he-border bg-he-surface-soft px-3 py-1.5 text-[11px] font-bold text-he-ink transition hover:border-he-purple/30 hover:bg-he-surface"
      title="Change location"
    >
      <PinIcon className="h-3.5 w-3.5 shrink-0 text-he-purple" />
      <span className="truncate">{summary}</span>
      <span className="shrink-0 text-he-purple">· Change</span>
    </button>
  )
}
