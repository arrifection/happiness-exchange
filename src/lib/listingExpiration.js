/** Listings no longer expire; helpers kept for call-site compatibility. */

export const LISTING_ACTIVE_DAYS = 14

export function resolveListingExpiresAt(item) {
  if (item?.listing_expires_at) {
    return new Date(item.listing_expires_at)
  }
  if (item?.created_at) {
    const created = new Date(item.created_at)
    if (!Number.isNaN(created.getTime())) {
      const expires = new Date(created)
      expires.setUTCDate(expires.getUTCDate() + LISTING_ACTIVE_DAYS)
      return expires
    }
  }
  return null
}

export function isListingExpired(_item) {
  return false
}

export function isListingActive(item) {
  if (item?.listing_active != null) return Boolean(item.listing_active)
  return item?.status === 'available'
}

export function formatListingExpiryLabel(_item) {
  return 'Active'
}
