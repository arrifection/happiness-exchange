import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import ItemForm from '../components/ItemForm.jsx'
import { Button, Surface } from '../components/ui.jsx'

export default function GiveItemPage({
  currentUser,
  itemForm,
  onItemChange,
  onItemImageUpload,
  onCreateItem,
  creatingItem,
  uploadingItemImage,
  itemMessage,
  itemError,
  imageUploadMessage,
  imageUploadError,
  onApplyGivePrefill,
  missingWhatsApp = false,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const prefillAppliedRef = useRef(false)

  useEffect(() => {
    if (prefillAppliedRef.current || !location.state?.prefill || !onApplyGivePrefill) {
      return
    }
    prefillAppliedRef.current = true
    onApplyGivePrefill(location.state.prefill)
  }, [location.state, onApplyGivePrefill])

  async function handlePublishItem(event) {
    const createdItem = await onCreateItem(event)

    if (!createdItem) {
      return
    }

    navigate('/item-listed-success', {
      state: {
        publishedItem: createdItem,
      },
    })
  }

  if (!currentUser) {
    return (
      <Surface className="p-5.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/80">Sign in first</p>
        <h1 className="mt-2 text-lg font-bold tracking-tight text-[#1f1f1f]">Log in before publishing</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-[#68766d]">
          We keep listings tied to real community accounts to ensure a safe space for everyone.
        </p>
        <div className="mt-5 flex gap-2">
          <Button as="link" to="/login" className="flex-1 h-9 min-h-0 text-xs py-2 px-3">Log in</Button>
          <Button as="link" to="/signup" variant="secondary" className="flex-1 h-9 min-h-0 text-xs py-2 px-3">Create account</Button>
        </div>
      </Surface>
    )
  }

  return (
    <Surface className="p-4.5 md:p-8 md:max-w-4xl md:mx-auto">
      {missingWhatsApp ? (
        <div className="mb-4 rounded-xl border border-he-danger/30 bg-he-danger/5 p-4 text-sm text-he-ink">
          <p className="font-semibold">WhatsApp number required</p>
          <p className="mt-1 text-he-muted">
            Please add your WhatsApp number in Settings before listing or requesting.{' '}
            <Link to="/profile" className="font-bold text-he-purple hover:underline">Go to Settings</Link>
          </p>
        </div>
      ) : null}
      <ItemForm
        itemForm={itemForm}
        onChange={onItemChange}
        onImageUpload={onItemImageUpload}
        onSubmit={handlePublishItem}
        creatingItem={creatingItem}
        uploadingItemImage={uploadingItemImage}
        itemMessage={itemMessage}
        itemError={itemError}
        imageUploadMessage={imageUploadMessage}
        imageUploadError={imageUploadError}
        disabled={!currentUser?.is_verified || missingWhatsApp}
      />
    </Surface>
  )
}
