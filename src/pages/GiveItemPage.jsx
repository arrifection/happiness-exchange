import { useNavigate } from 'react-router-dom'

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
}) {
  const navigate = useNavigate()

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
        disabled={!currentUser?.is_verified}
      />
    </Surface>
  )
}
