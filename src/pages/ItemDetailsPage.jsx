import { Navigate, useParams } from 'react-router-dom'

import ItemCard from '../components/ItemCard.jsx'
import { Button, EmptyState, Surface } from '../components/ui.jsx'

export default function ItemDetailsPage({
  currentUser,
  items,
  myItems,
  getMyRequestForItem,
  onCreateRequest,
  onDeleteItem,
  onCompleteItem,
  ownerActionItemId,
}) {
  const { itemId } = useParams()
  const item = [...myItems, ...items].find((entry) => entry.id === itemId)

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (!item) {
    return (
      <EmptyState
        title="Item not found"
        description="This listing may have been removed or is no longer available."
        action={<Button as="link" to="/browse">Back to Browse</Button>}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Surface className="p-6 sm:p-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1f6f50]">Item Details</p>
        <h1 className="mt-2 font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold tracking-tight text-[#1f3328] sm:text-3xl">
          {item.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#68766d]">
          View the full listing and manage it from here.
        </p>

        <div className="mt-6 max-w-3xl">
          <ItemCard
            item={item}
            currentUser={currentUser}
            myRequest={getMyRequestForItem(item.id)}
            onCreateRequest={onCreateRequest}
            onDeleteItem={onDeleteItem}
            onCompleteItem={onCompleteItem}
            ownerActionPending={ownerActionItemId === item.id}
          />
        </div>
      </Surface>

      <Surface className="p-6 sm:p-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8c755f]">About This Item</p>
        <p className="mt-3 text-sm leading-relaxed text-[#68766d]">{item.description}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-[#f4efe7] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">
            {item.category}
          </span>
          <span className="rounded-full bg-[#f4efe7] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">
            {item.condition}
          </span>
          <span className="rounded-full bg-[#f4efe7] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">
            {item.location}
          </span>
        </div>
      </Surface>
    </div>
  )
}
