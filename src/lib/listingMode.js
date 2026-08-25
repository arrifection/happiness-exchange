export function normalizeListingMode(mode) {
  return String(mode || 'GIVEAWAY').toUpperCase()
}

export function supportsExchange(item) {
  const mode = normalizeListingMode(item?.listing_mode)
  return mode === 'EXCHANGE' || mode === 'BOTH'
}

export function supportsGiveaway(item) {
  const mode = normalizeListingMode(item?.listing_mode)
  return mode === 'GIVEAWAY' || mode === 'BOTH'
}

export function listingModeLabel(mode) {
  switch (normalizeListingMode(mode)) {
    case 'EXCHANGE':
      return 'Exchange'
    case 'BOTH':
      return 'Give Away & Exchange'
    default:
      return 'Give Away'
  }
}

export function listingModeBadgeClass(mode) {
  switch (normalizeListingMode(mode)) {
    case 'EXCHANGE':
      return 'bg-[#f8edff] text-[#7340d2] ring-[#8b4cf6]/25'
    case 'BOTH':
      return 'bg-[#fff6d9] text-[#8c6900] ring-[#ffcc22]/50'
    default:
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200/50'
  }
}
