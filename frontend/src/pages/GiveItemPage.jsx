import { useNavigate } from 'react-router-dom'

import ItemForm from '../components/ItemForm.jsx'
import { Button, SectionHeading, Surface } from '../components/ui.jsx'

const givingTips = [
  'A warm, specific title helps the right person recognize the item quickly.',
  'Clear condition details build trust and make requests easier to review.',
  'If the image link breaks or is missing, your listing still gets a polished placeholder.',
]

export default function GiveItemPage({
  currentUser,
  itemForm,
  onItemChange,
  onCreateItem,
  creatingItem,
  itemMessage,
  itemError,
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

  return (
    <div className="space-y-8 pb-8">
      <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Surface className="overflow-hidden bg-[linear-gradient(180deg,#fff8ef,#f8efe4)] p-6 sm:p-8">
          <SectionHeading
            eyebrow="List an item"
            title="Someone nearby may truly need what you no longer use."
            description="Create a thoughtful listing that feels generous, clear, and easy for the community to trust."
            align="start"
          />
          <div className="mt-6 grid gap-3">
            {givingTips.map((tip) => (
              <div key={tip} className="flex items-start gap-3 rounded-[24px] bg-white/80 p-4 shadow-sm">
                <div className="mt-1 h-3 w-3 rounded-full bg-[#d86d4f]" />
                <p className="text-sm leading-7 text-[#61706b]">{tip}</p>
              </div>
            ))}
          </div>
        </Surface>

        {!currentUser ? (
          <Surface className="flex flex-col items-center justify-center p-8 text-center sm:p-12">
            <p className="inline-flex rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b35d3c]">
              Sign in first
            </p>
            <h2 className="mt-5 font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-3xl font-semibold tracking-[-0.04em] text-[#20352e]">
              Log in before publishing your next listing
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[#65736e]">
              We keep listings connected to real community members so requests stay personal, warm, and trustworthy.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button as="link" to="/login">
                Log in
              </Button>
              <Button as="link" to="/signup" variant="secondary">
                Create account
              </Button>
            </div>
          </Surface>
        ) : (
          <Surface className="p-6 sm:p-8 lg:p-10">
            <ItemForm
              itemForm={itemForm}
              onChange={onItemChange}
              onSubmit={handlePublishItem}
              creatingItem={creatingItem}
              itemMessage={itemMessage}
              itemError={itemError}
            />
          </Surface>
        )}
      </section>
    </div>
  )
}
