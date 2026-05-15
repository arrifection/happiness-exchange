import { useState } from 'react'

import { Button, StatusBadge } from './ui.jsx'

function categoryPalette(category = '') {
  const key = category.toLowerCase()

  if (key.includes('furniture')) {
    return 'bg-amber-100 text-amber-800'
  }

  if (key.includes('book')) {
    return 'bg-rose-100 text-rose-700'
  }

  if (key.includes('cloth') || key.includes('fashion')) {
    return 'bg-fuchsia-100 text-fuchsia-700'
  }

  if (key.includes('electronic') || key.includes('tech')) {
    return 'bg-sky-100 text-sky-700'
  }

  if (key.includes('baby') || key.includes('kid') || key.includes('toy')) {
    return 'bg-orange-100 text-orange-700'
  }

  return 'bg-emerald-100 text-emerald-700'
}

function ownerInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'HE'
}

export default function ItemCard({
  item,
  currentUser,
  myRequest,
  onCreateRequest,
}) {
  const [imageAvailable, setImageAvailable] = useState(Boolean(item.image_url))

  function renderInterestAction() {
    if (!currentUser || item.owner_id === currentUser.id) {
      return null
    }

    if (myRequest) {
      return (
        <p className="text-sm font-medium text-[#52655f]">
          Your request is
          {' '}
          <StatusBadge status={myRequest.status} className="ml-2 align-middle" />
        </p>
      )
    }

    if (item.status !== 'available') {
      return <p className="text-sm font-medium text-[#6a7672]">This item is currently {item.status}.</p>
    }

    return (
      <Button onClick={() => onCreateRequest(item.id)}>
        I&apos;m Interested
      </Button>
    )
  }

  return (
    <article className="group overflow-hidden rounded-[30px] border border-white/70 bg-white/80 shadow-[0_18px_50px_rgba(29,33,44,0.08)] backdrop-blur transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(29,33,44,0.14)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(135deg,rgba(140,188,166,0.9),rgba(240,184,160,0.88))]">
        {item.image_url && imageAvailable ? (
          <>
            <img
              src={item.image_url}
              alt={item.title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              onError={() => setImageAvailable(false)}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(32,53,46,0.58)_100%)]" />
          </>
        ) : (
          <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-8 text-center">
            <div className="absolute left-6 top-6 h-16 w-16 rounded-full bg-white/20 blur-xl" />
            <div className="absolute bottom-8 right-8 h-24 w-24 rounded-full bg-[#fff4ea]/30 blur-2xl" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] backdrop-blur">
              <div className="h-10 w-10 rounded-2xl border border-white/60 bg-white/80" />
            </div>
            <h3 className="relative mt-5 font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-xl font-semibold text-white">
              Shared with care
            </h3>
            <p className="relative mt-2 max-w-xs text-sm leading-6 text-white/85">
              A thoughtful gift waiting for someone nearby who can use it well.
            </p>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${categoryPalette(item.category)}`}>
            {item.category}
          </span>
          <StatusBadge status={item.status} className="bg-white/86 backdrop-blur" />
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/72">Shared by</p>
            <p className="mt-1 text-sm font-medium text-white">{item.owner_name}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/40 bg-white/18 text-sm font-semibold text-white backdrop-blur">
            {ownerInitials(item.owner_name)}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-2xl font-semibold tracking-[-0.04em] text-[#20352e]">
              {item.title}
            </h3>
          </div>
          <p className="text-sm leading-7 text-[#64736e]">{item.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#f3efe7] px-3 py-1.5 text-xs font-medium text-[#4f615b]">
            {item.location}
          </span>
          <span className="rounded-full bg-[#eef6f1] px-3 py-1.5 text-xs font-medium text-[#447261]">
            {item.condition}
          </span>
          <span className="rounded-full bg-[#fff2ea] px-3 py-1.5 text-xs font-medium text-[#b06144]">
            Free to request
          </span>
        </div>

        <div className="border-t border-[#f0ebe2] pt-4">
          {renderInterestAction()}
        </div>
      </div>
    </article>
  )
}
