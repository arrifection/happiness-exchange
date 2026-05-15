import { Navigate, useLocation } from 'react-router-dom'

import { Button, StatusBadge, Surface } from '../components/ui.jsx'

function PublishedItemPreview({ item }) {
  return (
    <div className="overflow-hidden rounded-[30px] border border-white/75 bg-white/84 shadow-[0_18px_50px_rgba(29,33,44,0.08)] backdrop-blur">
      <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(135deg,rgba(141,189,167,0.9),rgba(243,191,168,0.88))]">
        {item.image_url ? (
          <>
            <img
              src={item.image_url}
              alt={item.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(32,53,46,0.54)_100%)]" />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center text-white">
            <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur">
              <div className="h-10 w-10 rounded-2xl border border-white/60 bg-white/82" />
            </div>
            <h3 className="mt-5 font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-xl font-semibold">
              Shared with care
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/84">
              Your listing is ready for someone nearby to discover.
            </p>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <span className="rounded-full bg-white/82 px-3 py-1 text-xs font-semibold text-[#466359] shadow-sm">
            {item.category}
          </span>
          <StatusBadge status={item.status} className="bg-white/88 backdrop-blur" />
        </div>
      </div>

      <div className="space-y-4 p-6">
        <div>
          <h2 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-2xl font-semibold tracking-[-0.04em] text-[#20352e]">
            {item.title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#64736e]">{item.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#f3efe7] px-3 py-1.5 text-xs font-medium text-[#4f615b]">
            {item.condition}
          </span>
          <span className="rounded-full bg-[#eef6f1] px-3 py-1.5 text-xs font-medium text-[#447261]">
            {item.location}
          </span>
          <span className="rounded-full bg-[#fff2ea] px-3 py-1.5 text-xs font-medium text-[#b06144]">
            Visible to the community
          </span>
        </div>
      </div>
    </div>
  )
}

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
    <>
      <style>{`
        @keyframes item-listed-fade-in {
          0% {
            opacity: 0;
            transform: translateY(18px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}
      </style>

      <div className="pb-8" style={{ animation: 'item-listed-fade-in 0.65s ease-out' }}>
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Surface className="relative overflow-hidden bg-[linear-gradient(180deg,#fff8f0,#f7eee4)] p-6 sm:p-8 lg:p-10">
            <div className="absolute right-[-2rem] top-[-1rem] h-40 w-40 rounded-full bg-[#f0b89c]/35 blur-3xl" />
            <div className="absolute bottom-[-4rem] left-8 h-44 w-44 rounded-full bg-[#9fc6b1]/25 blur-3xl" />

            <div className="relative">
              <p className="inline-flex rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b35d3c] shadow-sm">
                Item published
              </p>
              <h1 className="mt-5 max-w-3xl text-balance font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-5xl font-semibold leading-[0.95] tracking-[-0.06em] text-[#20352e] sm:text-6xl">
                Your item is now available to the community.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#5f6d68] sm:text-lg">
                A small act of kindness can mean a lot to someone.
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#64736e]">
                Your listing is live, visible, and ready for the right person nearby to discover.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button as="link" to="/dashboard">
                  Back to Dashboard
                </Button>
                <Button as="link" to="/browse" variant="secondary">
                  Browse Community Items
                </Button>
              </div>
            </div>
          </Surface>

          <Surface className="p-6 sm:p-8 lg:p-10">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b35d3c]">Listing preview</p>
              <h2 className="mt-4 font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-3xl font-semibold tracking-[-0.04em] text-[#20352e]">
                Here&apos;s what the community will see
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#65736e]">
                The item preview below matches the listing you just shared.
              </p>
            </div>

            <PublishedItemPreview item={item} />
          </Surface>
        </div>
      </div>
    </>
  )
}
