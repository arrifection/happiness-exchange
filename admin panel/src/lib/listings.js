export function getListingId(item) {
  return item?.id || item?._id || ''
}

export function getListingStatusBadgeClass(status) {
  switch (status) {
    case 'active':
    case 'available':
      return 'badge-green'
    case 'pending':
      return 'badge-yellow'
    case 'donated':
    case 'completed':
      return 'badge-blue'
    case 'reserved':
      return 'badge-blue'
    case 'expired':
      return 'badge-gray'
    default:
      return 'badge-gray'
  }
}

export function formatListingDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function getListingOwnerLabel(item) {
  return item?.owner_name || item?.owner_id || item?.user_id || '—'
}

export function getListingImageUrl(item) {
  const url = item?.image_url
  return typeof url === 'string' && url.trim() ? url.trim() : null
}
