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
      <Surface className="p-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Sign in first</p>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-[#1f3328]">Log in before publishing</h1>
        <p className="mt-2 text-xs leading-relaxed text-[#68766d]">
          We keep listings tied to real community accounts to ensure a safe space for everyone.
        </p>
        <div className="mt-6 flex gap-3">
          <Button as="link" to="/login" className="flex-1">Log in</Button>
          <Button as="link" to="/signup" variant="secondary" className="flex-1">Create account</Button>
        </div>
      </Surface>
    )
  }

  return (
    <Surface className="p-8 sm:p-10">
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
      />
    </Surface>
  )
}
