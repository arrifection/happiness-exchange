import { useMemo, useState } from 'react'

import ItemCard from '../components/ItemCard.jsx'
import LocationSelector from '../components/LocationSelector.jsx'
import { Button, EmptyState } from '../components/ui.jsx'
import { readLocationPreferences, writeLocationPreferences } from '../lib/locations.js'

const CATEGORIES = ['All', 'Furniture', 'Home', 'Kids Goods', 'Books', 'Kitchen', 'Clothes', 'Family Items', 'Food', 'Other']
const STATUSES = ['All', 'Available', 'Reserved', 'Completed']
const SORT_OPTIONS = ['Newest first', 'Oldest first']

// Map display labels to actual DB values
const CATEGORY_DB_MAP = {
  'Kids Goods': ['Kids', 'Kid'],
  'Family Items': ['Baby', 'Family'],
}

function AnonymousBadge() {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-he-purple/20 bg-gradient-to-r from-[#efe7ff]/60 to-[#fff9e6]/40 px-4 py-2.5 backdrop-blur-sm dark:from-[#2d2640]/80 dark:to-[#2a2820]/60">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8b4cf6]/15">
        <svg className="h-4 w-4 text-[#8b4cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </div>
      <div>
        <p className="text-[11px] font-bold text-[#8b4cf6]">Completely Anonymous</p>
        <p className="text-[9px] text-he-soft">Addresses remain private · Courier handled securely</p>
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
  itemsError,
}) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('Available')
  const [sortBy, setSortBy] = useState('Newest first')
  const [locationPrefs, setLocationPrefs] = useState(() => readLocationPreferences())

  function handleLocationChange(values) {
    const next = {
      country: values.country,
      city: values.city,
      area: values.area || '',
      latitude: values.latitude ?? null,
      longitude: values.longitude ?? null,
      locationSource: values.locationSource || 'manual',
    }
    writeLocationPreferences(next)
    setLocationPrefs(next)
    onRefreshItems?.(next)
  }

  const filteredItems = useMemo(() => {
    let result = [...items]

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q) ||
          item.location?.toLowerCase().includes(q) ||
          item.location_display?.toLowerCase().includes(q) ||
          item.city?.toLowerCase().includes(q) ||
          item.country?.toLowerCase().includes(q),
      )
    }

    // Category — handle mapped labels
    if (categoryFilter !== 'All') {
      const dbValues = CATEGORY_DB_MAP[categoryFilter]
      result = result.filter((item) => {
        if (dbValues) {
          return dbValues.some((v) => item.category?.toLowerCase() === v.toLowerCase())
        }
        return item.category === categoryFilter
      })
    }

    // Status
    if (statusFilter !== 'All') {
      result = result.filter((item) => item.status === statusFilter.toLowerCase())
    }

    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      return sortBy === 'Newest first' ? dateB - dateA : dateA - dateB
    })

    return result
  }, [items, search, categoryFilter, statusFilter, sortBy])

  const hasActiveFilters = search || categoryFilter !== 'All' || statusFilter !== 'All'
    || locationPrefs.city || locationPrefs.locationSource === 'current_location'

  return (
    <div className="space-y-4">
      {/* Search Header Area */}
      <div className="space-y-3 md:space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg md:text-xl font-bold tracking-tight text-he-ink">
              Browse Items
            </h1>
            <p className="text-[10px] md:text-xs text-he-muted">Find items shared by your community.</p>
          </div>
          <button
            type="button"
            className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#8b4cf6] hover:underline"
            onClick={onRefreshItems}
            disabled={loadingItems}
          >
            {loadingItems ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Anonymous Trust Badge */}
        <AnonymousBadge />

        {/* Location filters */}
        <div className="rounded-2xl border border-he-border/60 bg-he-surface-soft/50 p-3 md:p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-he-muted">Location</p>
          <LocationSelector
            country={locationPrefs.country}
            city={locationPrefs.city}
            area={locationPrefs.area}
            latitude={locationPrefs.latitude}
            longitude={locationPrefs.longitude}
            locationSource={locationPrefs.locationSource}
            onChange={handleLocationChange}
            showArea={false}
          />
        </div>

        {/* Search Input Box */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search items, locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="he-field min-h-9 md:min-h-10 pl-9 pr-12 text-xs md:text-sm"
          />
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8c755f]/60">
            <svg className="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] md:text-xs font-bold text-[#c65d4a] hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="flex flex-wrap md:flex-nowrap md:justify-center gap-1.5 md:gap-2.5 pb-1 md:pb-0 overflow-x-auto md:overflow-x-visible no-scrollbar -mx-4 px-4 md:-mx-0 md:px-0 scroll-smooth">
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

        {/* Status and Sort */}
        <div className="flex flex-wrap sm:flex-nowrap md:justify-center gap-2 md:gap-4 md:pt-1">
          <div className="relative flex-1 md:flex-none md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="he-field h-8 md:h-10 appearance-none px-2.5 md:px-3.5 pr-7 text-[10px] md:text-[13px] font-bold text-he-soft"
            >
              {STATUSES.map((stat) => (
                <option key={stat} value={stat}>
                  {stat === 'All' ? 'All Statuses' : stat}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2.5 md:right-3 top-1/2 -translate-y-1/2 text-[#8c755f]/50">
              <svg className="h-3 w-3 md:h-3.5 md:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="relative flex-1 md:flex-none md:w-48">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="he-field h-8 md:h-10 appearance-none px-2.5 md:px-3.5 pr-7 text-[10px] md:text-[13px] font-bold text-he-soft"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2.5 md:right-3 top-1/2 -translate-y-1/2 text-[#8c755f]/50">
              <svg className="h-3 w-3 md:h-3.5 md:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearch('')
                setCategoryFilter('All')
                setStatusFilter('Available')
                const resetPrefs = { ...readLocationPreferences(), city: '', locationSource: 'manual', latitude: null, longitude: null }
                writeLocationPreferences(resetPrefs)
                setLocationPrefs(resetPrefs)
                onRefreshItems?.(resetPrefs)
              }}
              className="text-[10px] md:text-[13px] font-bold text-[#c65d4a] hover:underline px-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Results grid */}
      <div className="space-y-3 pt-1 md:pt-4">
        {itemsError ? <p className="text-xs font-medium text-[#c65d4a]">{itemsError}</p> : null}

        {!loadingItems && !itemsError && filteredItems.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'No items match your filters' : 'No items available yet'}
            description="Try adjusting your search or filters to see more listings."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-6">
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
        )}
      </div>
    </div>
  )
}
