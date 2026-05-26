import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import LocationSelector from '../components/LocationSelector.jsx'
import { ITEM_CATEGORIES, NEED_URGENCIES, urgencyLabel } from '../lib/categories.js'
import { showFlash } from '../lib/flash.js'
import { DEFAULT_COUNTRY, readLocationPreferences } from '../lib/locations.js'
import { Button, EmptyState, ErrorState, NeedCardSkeletonList, InlineLoadingNotice, SelectField, Surface, TextAreaField, TextField } from '../components/ui.jsx'

const STATUS_FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'all', label: 'All' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'closed', label: 'Closed' },
]

function urgencyClasses(urgency) {
  if (urgency === 'urgent') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200'
  if (urgency === 'low') return 'border-he-border bg-he-surface-soft text-he-soft'
  return 'border-[#8b4cf6]/20 bg-[#f5efff] text-[#7340d2] dark:border-he-purple/30 dark:bg-he-purple/10 dark:text-he-purple'
}

function NeedRequestCard({
  need,
  currentUser,
  onCloseNeed,
  onFulfillNeed,
  onHaveItem,
  actionPending,
}) {
  const isOwner = need.created_by === currentUser?.id

  return (
    <article className="rounded-card border border-he-border bg-he-surface p-4 shadow-sm transition hover:border-he-purple/20">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-he-ink">{need.title}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${urgencyClasses(need.urgency)}`}>
              {urgencyLabel(need.urgency)}
            </span>
            {need.status !== 'open' ? (
              <span className="rounded-full border border-he-border bg-he-surface-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-he-soft">
                {need.status}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-he-muted">
            {need.category} · {need.city}, {need.country}
          </p>
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-he-muted">{need.description}</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-he-border/50 pt-3">
        <p className="text-[10px] text-he-soft">
          Posted by {isOwner ? 'you' : need.created_by_name}
        </p>
        <div className="flex flex-wrap gap-2">
          {isOwner && need.status === 'open' ? (
            <>
              <Button
                type="button"
                variant="secondary"
                className="h-8 min-h-0 px-3 text-[10px]"
                disabled={actionPending}
                onClick={() => onFulfillNeed(need.id)}
              >
                Mark fulfilled
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-8 min-h-0 px-3 text-[10px] text-he-danger"
                disabled={actionPending}
                onClick={() => onCloseNeed(need.id)}
              >
                Close
              </Button>
            </>
          ) : null}
          {!isOwner && need.status === 'open' && currentUser ? (
            <Button
              type="button"
              className="h-8 min-h-0 px-3 text-[10px]"
              onClick={() => onHaveItem(need)}
            >
              I have this item
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default function NeedsBoardPage({
  currentUser,
  needRequests,
  loadingNeedRequests,
  needRequestsError,
  needRequestsMessage,
  onRefreshNeedRequests,
  onCreateNeedRequest,
  onCloseNeedRequest,
  onFulfillNeedRequest,
  creatingNeedRequest,
  needActionPendingId,
}) {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('open')
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState(() => {
    const prefs = readLocationPreferences()
    return {
      title: '',
      description: '',
      category: '',
      country: prefs.country || DEFAULT_COUNTRY,
      city: prefs.city || '',
      urgency: 'normal',
    }
  })

  const filteredNeeds = useMemo(() => {
    if (statusFilter === 'all') return needRequests
    return needRequests.filter((need) => need.status === statusFilter)
  }, [needRequests, statusFilter])

  function handleFormChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFormError('')
  }

  function handleLocationChange(values) {
    setForm((current) => ({
      ...current,
      country: values.country,
      city: values.city,
    }))
    setFormError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!currentUser?.is_verified) {
      setFormError('Verify your email before posting a need request.')
      return
    }
    if (!form.title.trim() || !form.description.trim() || !form.category || !form.city) {
      setFormError('Please complete title, description, category, and city.')
      return
    }
    if (form.description.trim().length < 10) {
      setFormError('Description must be at least 10 characters.')
      return
    }

    const result = await onCreateNeedRequest({
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      country: form.country,
      city: form.city,
      urgency: form.urgency,
    })

    if (result) {
      setShowForm(false)
      setForm((current) => ({
        ...current,
        title: '',
        description: '',
        category: '',
        urgency: 'normal',
      }))
    }
  }

  function handleHaveItem(need) {
    if (!currentUser?.is_verified) {
      showFlash('Please verify your email before offering an item.')
      return
    }
    navigate('/give', {
      state: {
        prefill: {
          title: need.title,
          category: need.category,
          country: need.country,
          city: need.city,
        },
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-he-ink md:text-xl">
            Community Needs
          </h1>
          <p className="text-[10px] text-he-muted md:text-xs">
            Browse what neighbors need, or post your own request.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-8 min-h-0 px-3 text-[10px]"
            onClick={() => onRefreshNeedRequests(statusFilter)}
            disabled={loadingNeedRequests}
          >
            {loadingNeedRequests ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button
            type="button"
            className="h-8 min-h-0 px-3 text-[10px]"
            onClick={() => {
              if (!currentUser) {
                navigate('/login')
                return
              }
              setShowForm((open) => !open)
            }}
          >
            {showForm ? 'Cancel' : 'Post a need'}
          </Button>
        </div>
      </div>

      {showForm ? (
        <Surface className="p-4 md:p-5">
          <h2 className="text-sm font-bold text-he-ink">Post what you need</h2>
          <p className="mt-1 text-[10px] text-he-muted">
            Tell the community what you are looking for if you cannot find it in Browse.
          </p>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <TextField
              id="need-title"
              name="title"
              label="Title"
              value={form.title}
              onChange={handleFormChange}
              placeholder="e.g. Baby stroller"
              required
            />
            <TextAreaField
              id="need-description"
              name="description"
              label="Description"
              value={form.description}
              onChange={handleFormChange}
              placeholder="Describe what you need and any helpful details."
              rows={4}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                id="need-category"
                name="category"
                label="Category"
                value={form.category}
                onChange={handleFormChange}
                options={ITEM_CATEGORIES}
                placeholder="Select category"
                required
              />
              <SelectField
                id="need-urgency"
                name="urgency"
                label="Urgency"
                value={form.urgency}
                onChange={handleFormChange}
                options={NEED_URGENCIES.map((option) => option.value)}
                required
              />
            </div>
            <LocationSelector
              country={form.country}
              city={form.city}
              locationSource="manual"
              onChange={handleLocationChange}
              showArea={false}
              showCurrentLocation={false}
              disabled={!currentUser?.is_verified}
            />
            {formError ? <p className="text-[10px] font-bold text-he-danger">{formError}</p> : null}
            {!currentUser?.is_verified ? (
              <p className="text-[10px] font-medium text-he-danger">Verify your email to post a need request.</p>
            ) : null}
            <Button type="submit" disabled={creatingNeedRequest || !currentUser?.is_verified} className="h-10 min-h-0 w-full sm:w-auto">
              {creatingNeedRequest ? 'Posting…' : 'Post need request'}
            </Button>
          </form>
        </Surface>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => {
              setStatusFilter(filter.value)
              onRefreshNeedRequests(filter.value)
            }}
            className={[
              'he-chip px-3.5 py-1.5 text-[10px]',
              statusFilter === filter.value ? 'he-chip-active' : '',
            ].join(' ')}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {needRequestsMessage ? (
        <p className="text-xs font-medium text-he-success">{needRequestsMessage}</p>
      ) : null}

      {needRequestsError ? (
        <ErrorState
          title="Couldn't load community needs"
          message={needRequestsError}
          onRetry={() => onRefreshNeedRequests(statusFilter)}
        />
      ) : null}

      {loadingNeedRequests && filteredNeeds.length === 0 ? (
        <NeedCardSkeletonList count={3} />
      ) : !loadingNeedRequests && !needRequestsError && filteredNeeds.length === 0 ? (
        <EmptyState
          icon="needs"
          title="No need requests yet"
          description="Be the first to post what you are looking for, or check back as the community grows."
          action={
            currentUser ? (
              <Button type="button" onClick={() => setShowForm(true)}>
                Post a need
              </Button>
            ) : (
              <Button as="link" to="/signup">Join to post a need</Button>
            )
          }
        />
      ) : (
        <>
          {loadingNeedRequests ? <InlineLoadingNotice label="Updating needs…" /> : null}
          <div className="grid gap-3">
            {filteredNeeds.map((need) => (
              <NeedRequestCard
                key={need.id}
                need={need}
                currentUser={currentUser}
                onCloseNeed={onCloseNeedRequest}
                onFulfillNeed={onFulfillNeedRequest}
                onHaveItem={handleHaveItem}
                actionPending={needActionPendingId === need.id}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
