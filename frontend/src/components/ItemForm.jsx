import { Button, TextAreaField, TextField } from './ui.jsx'

export default function ItemForm({
  itemForm,
  onChange,
  onSubmit,
  creatingItem,
  itemMessage,
  itemError,
}) {
  return (
    <form className="grid gap-6" onSubmit={onSubmit}>
      <div className="max-w-2xl">
        <p className="inline-flex rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b35d3c]">
          Share a listing
        </p>
        <h2 className="mt-4 font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-3xl font-semibold tracking-[-0.04em] text-[#20352e]">
          Tell the community what you&apos;re passing along
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#65736e]">
          Keep it clear, warm, and honest so someone nearby can quickly tell whether it is the right fit.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <TextField
          id="item-title"
          name="title"
          label="Title"
          value={itemForm.title}
          onChange={onChange}
          placeholder="Wooden study table"
          required
        />
        <TextField
          id="item-category"
          name="category"
          label="Category"
          value={itemForm.category}
          onChange={onChange}
          placeholder="Furniture"
          required
        />
        <div className="lg:col-span-2">
          <TextAreaField
            id="item-description"
            name="description"
            label="Description"
            value={itemForm.description}
            onChange={onChange}
            placeholder="Describe the size, condition, pickup expectations, and anything helpful to know."
            rows={5}
            required
          />
        </div>
        <TextField
          id="item-condition"
          name="condition"
          label="Condition"
          value={itemForm.condition}
          onChange={onChange}
          placeholder="Gently used"
          required
        />
        <TextField
          id="item-location"
          name="location"
          label="Location"
          value={itemForm.location}
          onChange={onChange}
          placeholder="Lahore"
          required
        />
        <div className="lg:col-span-2">
          <TextField
            id="item-image-url"
            name="image_url"
            label="Image URL"
            value={itemForm.image_url}
            onChange={onChange}
            placeholder="https://example.com/item.jpg"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-[28px] border border-[#f0e8dc] bg-[#fff9f3] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-[#29413b]">Listings stay free and community-first.</p>
          <p className="mt-1 text-sm text-[#6a7773]">You can add an image, or we&apos;ll show premium placeholder artwork automatically.</p>
        </div>
        <Button type="submit" className="sm:min-w-44" disabled={creatingItem}>
          {creatingItem ? 'Creating item...' : 'Create item'}
        </Button>
      </div>

      {itemMessage ? <p className="text-sm font-medium text-[#1d6b57]">{itemMessage}</p> : null}
      {itemError ? <p className="text-sm font-medium text-[#b04e43]">{itemError}</p> : null}
    </form>
  )
}
