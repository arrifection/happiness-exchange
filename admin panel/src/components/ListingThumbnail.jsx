import { Package } from 'lucide-react'

import { getListingImageUrl } from '../lib/listings'

export default function ListingThumbnail({ item, size = 'md' }) {
  const imageUrl = getListingImageUrl(item)
  const sizeClass = size === 'sm' ? 'h-9 w-9 rounded-lg' : 'h-14 w-14 rounded-xl'

  if (!imageUrl) {
    return (
      <div className={`${sizeClass} flex flex-shrink-0 items-center justify-center border border-brand-100 bg-brand-50`}>
        <Package className={`${size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} text-brand-600`} />
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={item?.title || 'Listing image'}
      className={`${sizeClass} flex-shrink-0 border border-surface-300 object-cover`}
      loading="lazy"
    />
  )
}
