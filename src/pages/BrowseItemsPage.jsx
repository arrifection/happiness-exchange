import { useMemo, useState } from 'react'

import ItemCard from '../components/ItemCard.jsx'
import { Button, EmptyState } from '../components/ui.jsx'

const CATEGORIES = ['All', 'Furniture', 'Home', 'Kids', 'Books', 'Kitchen', 'Clothes', 'Other']
const STATUSES = ['All', 'Available', 'Reserved', 'Completed']
const SORT_OPTIONS = ['Newest first', 'Oldest first']

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
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortBy, setSortBy] = useState('Newest first')

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
          item.location?.toLowerCase().includes(q),
      )
    }

    // Category
    if (categoryFilter !== 'All') {
      result = result.filter((item) => {
        if (categoryFilter === 'Kids' && item.category === 'Baby') return true;
        return item.category === categoryFilter;
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

  return (
    <div className="space-y-4">
      {/* Search Header Area */}
      <div className="space-y-3 md:space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg md:text-xl font-bold tracking-tight text-[#1f1f1f]">
              Browse Items
            </h1>
            <p className="text-[10px] md:text-xs text-[#68766d]">Find items shared by neighbors.</p>
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

        {/* Search Input Box */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search items, locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-9 md:min-h-10 w-full rounded-input border border-[#efe8da] bg-[#fffdfb] pl-9 pr-12 text-xs md:text-sm text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10"
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

        {/* Categories Carousel / Wrap Grid */}
        <div className="flex flex-wrap md:flex-nowrap md:justify-center gap-1.5 md:gap-2.5 pb-1 md:pb-0 overflow-x-auto md:overflow-x-visible no-scrollbar -mx-4 px-4 md:-mx-0 md:px-0 scroll-smooth">
          {CATEGORIES.map((cat) => {
            const isActive = categoryFilter === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={[
                  'shrink-0 rounded-full px-3.5 py-1.5 md:px-4 md:py-2 text-[10px] md:text-[13px] font-bold transition-all duration-200',
                  isActive
                    ? 'bg-[#8b4cf6] text-white shadow-xs'
                    : 'border border-[#efe8da] bg-[#fffdfb] text-[#8c755f] hover:text-[#1f1f1f]',
                ].join(' ')}
              >
                {cat === 'All' ? 'All Categories' : cat}
              </button>
            )
          })}
        </div>

        {/* Status and Sorting Compact Grid */}
        <div className="flex flex-wrap sm:flex-nowrap md:justify-center gap-2 md:gap-4 md:pt-1">
          <div className="relative flex-1 md:flex-none md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 md:h-10 w-full appearance-none rounded-input border border-[#efe8da] bg-[#fffdfb] px-2.5 md:px-3.5 pr-7 text-[10px] md:text-[13px] font-bold text-[#8c755f] outline-none transition focus:border-[#8b4cf6]"
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
              className="h-8 md:h-10 w-full appearance-none rounded-input border border-[#efe8da] bg-[#fffdfb] px-2.5 md:px-3.5 pr-7 text-[10px] md:text-[13px] font-bold text-[#8c755f] outline-none transition focus:border-[#8b4cf6]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
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
                setStatusFilter('All')
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
