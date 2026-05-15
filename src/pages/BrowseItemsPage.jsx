import { useMemo, useState } from 'react'

import ItemCard from '../components/ItemCard.jsx'
import { Button, EmptyState, SectionHeading, Surface, TextField } from '../components/ui.jsx'

const CATEGORIES = ['All', 'Furniture', 'Home', 'Baby', 'Books', 'Kitchen', 'Clothes', 'Other']
const STATUSES = ['All', 'Available', 'Reserved', 'Completed']
const SORT_OPTIONS = ['Newest first', 'Oldest first']

export default function BrowseItemsPage({
  items,
  currentUser,
  getMyRequestForItem,
  onCreateRequest,
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
      result = result.filter((item) => item.category === categoryFilter)
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

  return (
    <div className="space-y-6">
      <Surface className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <SectionHeading
              title="Community Listings"
              description="Find items shared by your neighbors."
            />
            <Button variant="ghost" className="h-8 min-h-0 px-2 text-[10px]" onClick={onRefreshItems}>
              Refresh
            </Button>
          </div>

          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <TextField
                placeholder="Search items, location, or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8c755f]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-9 rounded-xl border border-[#eadfce] bg-[#faf7f1] px-3 text-[11px] font-bold uppercase tracking-widest text-[#1f3328] outline-none focus:border-[#1f6f50]"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat === 'All' ? 'Categories' : cat}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 rounded-xl border border-[#eadfce] bg-[#faf7f1] px-3 text-[11px] font-bold uppercase tracking-widest text-[#1f3328] outline-none focus:border-[#1f6f50]"
                >
                  {STATUSES.map((stat) => (
                    <option key={stat} value={stat}>{stat === 'All' ? 'Status' : stat}</option>
                  ))}
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-9 rounded-xl border border-[#eadfce] bg-[#faf7f1] px-3 text-[11px] font-bold uppercase tracking-widest text-[#1f3328] outline-none focus:border-[#1f6f50]"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Reset Button (Visible if filters active) */}
              {(search || categoryFilter !== 'All' || statusFilter !== 'All') && (
                <button
                  onClick={() => {
                    setSearch('')
                    setCategoryFilter('All')
                    setStatusFilter('All')
                  }}
                  className="text-[10px] font-bold uppercase tracking-widest text-[#c65d4a] hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </Surface>

      <div className="space-y-4">
        {loadingItems ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#68766d]">Updating listings...</p> : null}
        {itemsError ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#c65d4a]">{itemsError}</p> : null}

        {!loadingItems && !itemsError && filteredItems.length === 0 ? (
          <EmptyState
            title={search || categoryFilter !== 'All' || statusFilter !== 'All' ? 'No items match your filters' : 'No items available yet'}
            description="Try adjusting your search or filters to see more listings."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                currentUser={currentUser}
                myRequest={getMyRequestForItem(item.id)}
                onCreateRequest={onCreateRequest}
                compact
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
