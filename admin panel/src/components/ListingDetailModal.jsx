import { useEffect, useState } from 'react'
import { Loader2, MapPin, Package, User, X } from 'lucide-react'

import { itemsApi } from '../lib/api'
import { resolveApiError } from '../lib/backend'
import {
  formatListingDate,
  getListingId,
  getListingImageUrl,
  getListingOwnerLabel,
  getListingStatusBadgeClass,
} from '../lib/listings'

export default function ListingDetailModal({ itemId, fallbackItem, open, onClose }) {
  const [item, setItem] = useState(fallbackItem || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    setError('')
    if (!itemId) {
      setItem(fallbackItem || null)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await itemsApi.getById(itemId)
        if (!cancelled) setItem(res.data)
      } catch (err) {
        if (!cancelled) {
          setError(resolveApiError(err, 'Unable to load listing details.'))
          setItem(fallbackItem || null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [open, itemId, fallbackItem])

  if (!open) return null

  const imageUrl = getListingImageUrl(item)
  const title = item?.title || item?.name || 'Untitled listing'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-surface-900/40 backdrop-blur-[1px]"
        aria-label="Close listing details"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-surface-300 bg-white shadow-card-hover">
        <div className="flex items-center justify-between border-b border-surface-300 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-surface-800">Listing details</h3>
            <p className="text-xs text-surface-500">ID: {getListingId(item) || itemId || '—'}</p>
          </div>
          <button type="button" className="btn-icon btn-ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
            </div>
          ) : (
            <>
              {error ? (
                <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={title}
                  className="mb-5 h-56 w-full rounded-xl border border-surface-300 object-cover"
                />
              ) : (
                <div className="mb-5 flex h-40 items-center justify-center rounded-xl border border-dashed border-surface-300 bg-surface-100">
                  <Package className="h-8 w-8 text-surface-400" />
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">Title</p>
                  <p className="mt-1 text-lg font-semibold text-surface-800">{title}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className={`badge ${getListingStatusBadgeClass(item?.status)}`}>
                    {item?.status || 'unknown'}
                  </span>
                  {item?.category ? <span className="badge badge-blue">{item.category}</span> : null}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">Description</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-surface-700">
                    {item?.description || 'No description provided.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-surface-300 bg-surface-100/60 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-surface-500">
                      <User className="h-3.5 w-3.5" />
                      Lister
                    </div>
                    <p className="mt-1 text-sm text-surface-800">{getListingOwnerLabel(item)}</p>
                  </div>
                  <div className="rounded-lg border border-surface-300 bg-surface-100/60 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-surface-500">
                      <MapPin className="h-3.5 w-3.5" />
                      Location
                    </div>
                    <p className="mt-1 text-sm text-surface-800">
                      {item?.location_display || item?.location || item?.city || '—'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">Created</p>
                    <p className="mt-1 text-sm text-surface-800">{formatListingDate(item?.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">Requests</p>
                    <p className="mt-1 text-sm text-surface-800">
                      {typeof item?.request_count === 'number' ? item.request_count : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
