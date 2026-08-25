import { listingModeBadgeClass, listingModeLabel } from '../lib/listingMode.js'

export default function ListingModeBadge({ mode, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${listingModeBadgeClass(mode)} ${className}`.trim()}
    >
      {listingModeLabel(mode)}
    </span>
  )
}
