import { useEffect, useMemo, useState } from 'react'

import BrowseLocationPill from '../components/BrowseLocationPill.jsx'
import ItemCard from '../components/ItemCard.jsx'
import LocationSetupModal from '../components/LocationSetupModal.jsx'
import ItemsBrowseMap from '../components/map/ItemsBrowseMap.jsx'
import { Button, EmptyState, ErrorState, ItemCardSkeletonGrid, InlineLoadingNotice } from '../components/ui.jsx'
import { readLocationPreferences, writeLocationPreferences } from '../lib/locations.js'
import { supportsExchange } from '../lib/listingMode.js'

const CATEGORIES = ['All', 'Furniture', 'Home', 'Kids Goods', 'Books', 'Kitchen', 'Clothes', 'Family Items', 'Food', 'Other']
const STATUSES = ['All', 'Available', 'Reserved', 'Completed']
const SORT_OPTIONS = ['Newest first', 'Oldest first']

const CATEGORY_DB_MAP = {
  'Kids Goods': ['Kids', 'Kid'],
  'Family Items': ['Baby', 'Family'],
}

function AnonymousBadge() {
  return (
    <div className="he-info-banner">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-he-purple/15 dark:bg-he-purple/25">
        <svg className="h-4 w-4 text-he-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </div>
      <div>
        <p className="text-[11px] font-bold text-he-purple">Completely Anonymous</p>
        <p className="text-[10px] text-he-soft">Addresses remain private · Admin coordinates approved exchanges</p>
      </div>
    </div>
  )
}

export default function BrowseItemsPage({
  items,
  currentUser,
  getMyRequestForItem,
  getReviewContextForItem,
  onCreateRequest,
  onOpenReview,
  onRefreshItems,
  loadingItems,
  loadingMoreItems = false,
  itemsError,
  itemsPagination = {
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
    next_cursor: null,
    has_more: false,
  },
}) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('Available')
  const [sortBy, setSortBy] = useState('Newest first')
  const [listingTypeFilter, setListingTypeFilter] = useState('All')
  const [locationPrefs, setLocationPrefs] = useState(() => readLocationPreferences())
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)

  function handleLocationSave(values) {
    const next = {
      country: values.country,
      city: values.city,
      area: values.area || '',
      latitude: values.latitude ?? null,
      longitude: values.longitude ?? null,
      locationSource: values.locationSource || values.location_source || 'manual',
    }
    writeLocationPreferences(next)
    setLocationPrefs(next)
    onRefreshItems?.(next, { ...buildStatusQuery(statusFilter), page: 1 })
  }

  function buildStatusQuery(filter) {
    if (filter === 'All') return { status: 'all' }
    return { status: filter.toLowerCase() }
  }

  function loadMoreItems() {
    if (!itemsPagination.has_more || !itemsPagination.next_cursor || loadingMoreItems) return
    onRefreshItems?.(locationPrefs, {
      ...buildStatusQuery(statusFilter),
      append: true,
      cursor: itemsPagination.next_cursor,
    })
  }

  useEffect(() => {
    onRefreshItems?.(locationPrefs, { ...buildStatusQuery(statusFilter), page: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when status filter changes
  }, [statusFilter])

  const loadedCount = items.length

  const filteredItems = useMemo(() => {
    let result = [...items]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q),
      )
    }

    if (categoryFilter !== 'All') {
      const dbValues = CATEGORY_DB_MAP[categoryFilter]
      result = result.filter((item) => {
        if (dbValues) {
          return dbValues.some((v) => item.category?.toLowerCase() === v.toLowerCase())
        }
        return item.category === categoryFilter
      })
    }

    if (statusFilter !== 'All') {
      result = result.filter((item) => item.status === statusFilter.toLowerCase())
    }

    if (listingTypeFilter === 'Exchange') {
      result = result.filter((item) => supportsExchange(item))
    }

    result.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      return sortBy === 'Newest first' ? dateB - dateA : dateA - dateB
    })

    return result
  }, [items, search, categoryFilter, statusFilter, sortBy, listingTypeFilter])

  const hasActiveFilters = search || categoryFilter !== 'All' || statusFilter !== 'All'
    || locationPrefs.city || locationPrefs.locationSource === 'current_location'

  function resetFilters() {
    setSearch('')
    setCategoryFilter('All')
    setStatusFilter('Available')
    setListingTypeFilter('All')
    const resetPrefs = { ...readLocationPreferences(), city: '', locationSource: 'manual', latitude: null, longitude: null }
    writeLocationPreferences(resetPrefs)
    setLocationPrefs(resetPrefs)
    onRefreshItems?.(resetPrefs, { ...buildStatusQuery('Available'), page: 1 })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg md:text-xl font-bold tracking-tight text-he-ink">
              Browse Items
            </h1>
            <p className="text-[10px] md:text-xs text-he-muted">Find items shared by your community.</p>
          </div>
          <button
            type="button"
            className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-he-purple hover:underline"
            onClick={() => onRefreshItems?.(locationPrefs, { ...buildStatusQuery(statusFilter), page: itemsPagination.page })}
            disabled={loadingItems}
          >
            {loadingItems ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <AnonymousBadge />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <BrowseLocationPill
            locationPrefs={locationPrefs}
            onOpenSetup={() => setLocationModalOpen(true)}
          />
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="he-field min-h-9 w-full pl-9 pr-12 text-xs md:min-h-10 md:text-sm"
            />
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8c755f]/60">
              <svg className="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#c65d4a] hover:underline md:text-xs"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1 no-scrollbar md:flex-wrap md:gap-2 md:overflow-visible md:pb-0">
          {['All', 'Exchange'].map((type) => {
            const isActive = listingTypeFilter === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => setListingTypeFilter(type)}
                className={[
                  'he-chip px-3.5 py-1.5 md:px-4 md:py-2 text-[10px] md:text-[13px]',
                  isActive ? 'he-chip-active' : '',
                ].join(' ')}
              >
                {type === 'All' ? 'All listings' : 'Exchange'}
              </button>
            )
          })}
        </div>

        <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1 no-scrollbar md:flex-wrap md:gap-2 md:overflow-visible md:pb-0">
          {CATEGORIES.map((cat) => {
            const isActive = categoryFilter === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={[
                  'he-chip px-3.5 py-1.5 md:px-4 md:py-2 text-[10px] md:text-[13px]',
                  isActive ? 'he-chip-active' : '',
                ].join(' ')}
              >
                {cat === 'All' ? 'All Categories' : cat}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="relative min-w-[140px] flex-1 md:flex-none md:w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="he-field h-9 w-full appearance-none px-3 pr-8 text-[11px] font-bold text-he-soft md:h-10 md:text-[13px]"
            >
              {STATUSES.map((stat) => (
                <option key={stat} value={stat}>
                  {stat === 'All' ? 'All Statuses' : stat}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8c755f]/50">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="relative min-w-[140px] flex-1 md:flex-none md:w-44">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="he-field h-9 w-full appearance-none px-3 pr-8 text-[11px] font-bold text-he-soft md:h-10 md:text-[13px]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8c755f]/50">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMapOpen((open) => !open)}
            className="inline-flex h-9 shrink-0 items-center rounded-full border border-he-border bg-he-surface-soft px-3 text-[10px] font-bold uppercase tracking-widest text-he-purple transition hover:border-he-purple/30 md:h-10"
          >
            {mapOpen ? 'Hide map' : 'View map'}
          </button>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="px-1 text-[10px] font-bold text-[#c65d4a] hover:underline md:text-xs"
            >
              Reset
            </button>
          ) : null}

          <span className="ml-auto hidden text-[10px] text-he-muted sm:inline">
            {itemsPagination.total || filteredItems.length} listing{(itemsPagination.total || filteredItems.length) === 1 ? '' : 's'}
          </span>
        </div>

        {mapOpen ? (
          <ItemsBrowseMap
            items={filteredItems}
            country={locationPrefs.country}
            city={locationPrefs.city}
            userLatitude={locationPrefs.latitude}
            userLongitude={locationPrefs.longitude}
            showUserLocation={locationPrefs.locationSource === 'current_location'}
            defaultOpen
          />
        ) : null}
      </div>

      <div className="space-y-3 pt-1">
        {loadingItems && items.length === 0 ? (
          <ItemCardSkeletonGrid count={4} />
        ) : itemsError ? (
          <ErrorState
            title="Couldn't load items"
            message={itemsError}
            onRetry={() => onRefreshItems?.(locationPrefs, { ...buildStatusQuery(statusFilter), page: itemsPagination.page })}
          />
        ) : !loadingItems && filteredItems.length === 0 ? (
          <EmptyState
            icon={hasActiveFilters ? 'search' : 'items'}
            title={hasActiveFilters ? 'No items match your filters' : 'No items available yet'}
            description={
              hasActiveFilters
                ? 'Try adjusting your search or filters to see more listings.'
                : 'Check back soon — new items are added as community members list things to share.'
            }
            action={
              hasActiveFilters ? (
                <Button type="button" variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button as="link" to={currentUser ? '/give' : '/signup'}>
                  {currentUser ? 'List an item' : 'Join the community'}
                </Button>
              )
            }
          />
        ) : (
          <>
            {loadingItems ? <InlineLoadingNotice label="Updating listings…" /> : null}
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-6">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  currentUser={currentUser}
                  myRequest={getMyRequestForItem(item.id)}
                  reviewContext={getReviewContextForItem(item)}
                  onCreateRequest={onCreateRequest}
                  onOpenReview={onOpenReview}
                  compact
                />
              ))}
            </div>

            {itemsPagination.has_more ? (
              <div className="flex flex-col items-center gap-2 border-t border-he-border/60 pt-4">
                <p className="text-[11px] text-he-muted">
                  Showing {loadedCount} of {itemsPagination.total} listings
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 min-h-0 px-5 text-[11px]"
                  disabled={loadingItems || loadingMoreItems}
                  onClick={loadMoreItems}
                >
                  {loadingMoreItems ? 'Loading more…' : 'Load more'}
                </Button>
              </div>
            ) : itemsPagination.total > 0 ? (
              <p className="border-t border-he-border/60 pt-4 text-center text-[11px] text-he-muted">
                {itemsPagination.total} listing{itemsPagination.total === 1 ? '' : 's'} total
              </p>
            ) : null}
          </>
        )}
      </div>

      <LocationSetupModal
        open={locationModalOpen}
        initialPrefs={locationPrefs}
        onSave={handleLocationSave}
        onClose={() => setLocationModalOpen(false)}
      />
    </div>
  )
}
