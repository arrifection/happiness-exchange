/**
 * "Previous listings" are the owner's finished listings — the ones that already
 * went through an approved give-away request or a completed exchange.
 *
 * The delete guard here mirrors the backend rule in
 * ``app/api/routes/items.py``: a listing with a swap still in flight must not be
 * deleted, so the action is never offered for one.
 */

const PREVIOUS_LISTING_STATUSES = new Set(['completed'])

export function isPreviousListing(item) {
  if (!item) return false
  return PREVIOUS_LISTING_STATUSES.has(String(item.status || '').toLowerCase())
}

export function selectPreviousListings(items) {
  if (!Array.isArray(items)) return []
  return items.filter(isPreviousListing)
}

export function canDeletePreviousListing(item) {
  if (!isPreviousListing(item)) return false
  if (item.exchange_reserved) return false
  if (item.active_exchange_offer_id) return false
  return true
}
