import ItemForm from '../components/ItemForm.jsx'
import { Button, SectionHeading, Surface } from '../components/ui.jsx'

const givingTips = [
  'Use a specific title so people know exactly what you are offering.',
  'Mention the condition honestly to keep requests thoughtful and easy to review.',
  'If you have no image, the card will still look polished with placeholder artwork.',
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
  return (
    <div className="space-y-8 pb-8">
      <section className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <Surface className="bg-[linear-gradient(180deg,#fff8ef,#f8efe4)] p-6 sm:p-8">
          <SectionHeading
            eyebrow="Give an item"
            title="Turn extra things at home into community value"
            description="A polished listing form helps you share clearly while keeping the experience beginner-friendly."
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
              Create an account before posting your first listing
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[#65736e]">
              We keep listings connected to real community members so requests stay personal and trustworthy.
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
              onSubmit={onCreateItem}
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
