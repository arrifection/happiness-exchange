export const ITEM_PLACEHOLDER_URL = '/item-placeholder.svg'

export function itemHasCustomImage(imageUrl) {
  return Boolean(imageUrl?.trim())
}

export function resolveItemImageUrl(imageUrl) {
  return itemHasCustomImage(imageUrl) ? imageUrl.trim() : ITEM_PLACEHOLDER_URL
}
