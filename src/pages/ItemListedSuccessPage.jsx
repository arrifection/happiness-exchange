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
    <div className="space-y-5">
      <Surface className="p-6 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#8b4cf6]/10 text-[#8b4cf6]">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-3 font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold tracking-tight text-[#1f1f1f]">
          Successfully Published
        </h1>
        <p className="mt-1.5 text-xs leading-relaxed text-[#68766d]">
          Your item is now live and available to neighbors.
        </p>
        <div className="mt-6 flex gap-2">
          <Button as="link" to="/dashboard" className="flex-1 h-9 min-h-0 text-xs py-2 px-3">Dashboard</Button>
          <Button as="link" to="/browse" variant="secondary" className="flex-1 h-9 min-h-0 text-xs py-2 px-3">Browse</Button>
        </div>
      </Surface>

      <div className="space-y-2.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/80">Listing Preview</p>
        <ItemCard item={item} currentUser={currentUser} compact />
      </div>
    </div>
  )
}
