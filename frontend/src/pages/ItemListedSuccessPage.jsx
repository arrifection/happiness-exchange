import { Navigate, useLocation } from 'react-router-dom'

import ItemCard from '../components/ItemCard.jsx'
import { Button, Surface } from '../components/ui.jsx'

export default function ItemListedSuccessPage({ currentUser, publishedItem }) {
  const location = useLocation()
  const item = location.state?.publishedItem || publishedItem

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (!item) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="space-y-6">
      <Surface className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1f6f50]/10 text-[#1f6f50]">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-4 font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold tracking-tight text-[#1f3328]">
          Successfully Published
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-[#68766d]">
          Your item is now live and available to your neighbors.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button as="link" to="/dashboard" className="sm:min-w-[140px]">Go to Dashboard</Button>
          <Button as="link" to="/browse" variant="secondary" className="sm:min-w-[140px]">Browse Items</Button>
        </div>
      </Surface>

      <div className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Listing Preview</p>
        <div className="max-w-md">
          <ItemCard item={item} currentUser={currentUser} compact />
        </div>
      </div>
    </div>
  )
}
