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

export function isListingExpired(item) {
  if (item?.is_expired != null) return Boolean(item.is_expired)
  if (item?.status === 'completed') return false
  const expiresAt = resolveListingExpiresAt(item)
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return false
  return expiresAt.getTime() <= Date.now()
}

export function isListingActive(item) {
  if (item?.listing_active != null) return Boolean(item.listing_active)
  if (item?.status !== 'available') return false
  return !isListingExpired(item)
}

export function formatListingExpiryLabel(item) {
  if (isListingExpired(item)) return 'Expired'
  const expiresAt = resolveListingExpiresAt(item)
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return 'Active'
  return `Active until ${expiresAt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })}`
}
