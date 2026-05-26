import { itemHasCustomImage } from './itemImages.js'

const DEMO_TITLE_PATTERNS = [
  /^(smoke test|demo |test item|sample |atlas test)/i,
  /\b(smoke test|demo listing|test listing|atlas test)\b/i,
]

const DEMO_DESCRIPTION_PATTERNS = [
  /verifying mongodb atlas/i,
  /\bgoooo+\b/i,
]

export function isDemoListing(item) {
  if (!item || item.is_demo || item.is_test) {
    return true
  }

  const title = item.title || item.name || ''
  if (DEMO_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return true
  }

  const description = item.description || ''
  return DEMO_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(description))
}

export function getFeaturedHomeItems(items, limit = 6) {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .filter(
      (item) =>
        item.status === 'available' &&
        itemHasCustomImage(item.image_url) &&
        !isDemoListing(item),
    )
    .slice(0, limit)
}
