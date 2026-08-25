import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiUrl, asArray } from '../lib/api.js'
import { resolveItemImageUrl, ITEM_PLACEHOLDER_URL } from '../lib/itemImages.js'
import { listingModeLabel } from '../lib/listingMode.js'
import { exchangeActionErrorMessage } from '../lib/exchangeErrors.js'
import { displayTransactionCity } from '../lib/locations.js'
import { Button, EmptyState, ErrorState, StatusBadge, Surface } from '../components/ui.jsx'

const TABS = [
  { id: 'mine', label: 'My Swap Offers' },
  { id: 'incoming', label: 'Incoming Offers' },
]

function offerImage(offer) {
  if (offer.offered_listing_image) return resolveItemImageUrl(offer.offered_listing_image)
  if (offer.custom_item_image) return resolveItemImageUrl(offer.custom_item_image)
  return ITEM_PLACEHOLDER_URL
}

function offerTitle(offer) {
  return offer.offered_listing_title || offer.custom_item_title || 'Custom item'
}

export default function ExchangeOffersPage({ currentUser, token }) {
  const [activeTab, setActiveTab] = useState('mine')
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionId, setActionId] = useState('')

  async function loadOffers(tab = activeTab) {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const path = tab === 'incoming' ? '/api/exchange-offers/incoming' : '/api/exchange-offers/my'
      const res = await fetch(apiUrl(path), {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not load swap offers.')
      setOffers(asArray(data.offers))
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOffers(activeTab)
  }, [activeTab, token])

  async function runAction(offerId, action) {
    setActionId(offerId)
    setActionError('')
    try {
      const res = await fetch(apiUrl(`/api/exchange-offers/${offerId}/${action}`), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      let data = null
      try {
        data = await res.json()
      } catch {
        data = null
      }
      if (!res.ok) throw new Error(exchangeActionErrorMessage(res.status, data?.detail))
      await loadOffers(activeTab)
      if (data.transaction_id) {
        window.location.href = `/exchange/${data.transaction_id}`
      }
    } catch (failedAction) {
      setActionError(failedAction.message)
    } finally {
      setActionId('')
    }
  }

  if (!currentUser) {
    return (
      <EmptyState
        icon="items"
        title="Sign in to view swaps"
        description="Log in to propose swaps and manage exchange offers."
        action={<Button as="link" to="/login">Log in</Button>}
      />
    )
  }

  return (
    <div className="app-shell mx-auto max-w-4xl space-y-5 px-4 py-6">
      <Surface className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-he-purple">Exchange</p>
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold text-he-ink">Exchange / Swap</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button as="link" to="/browse">Browse listings</Button>
          <Button as="link" to="/give?mode=exchange" variant="secondary">Create Exchange listing</Button>
        </div>
      </Surface>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition ${
              activeTab === tab.id
                ? 'bg-he-purple text-white'
                : 'border border-he-border bg-he-surface text-he-muted hover:text-he-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-he-muted">Loading swap offers…</p> : null}
      {error ? <ErrorState title="Could not load swaps" message={error} onRetry={() => loadOffers(activeTab)} /> : null}
      {actionError ? <p className="text-sm font-bold text-he-danger">{actionError}</p> : null}

      {!loading && !error && offers.length === 0 ? (
        <EmptyState
          icon="items"
          title={activeTab === 'incoming' ? 'No incoming swap offers yet' : 'No swap offers yet'}
          description={
            activeTab === 'incoming'
              ? 'When someone proposes a swap on your exchange listings, offers appear here.'
              : 'Open a swap-enabled listing and click Propose a Swap to send your first offer.'
          }
          action={<Button as="link" to="/browse">Find swap listings</Button>}
        />
      ) : null}

      <div className="space-y-3">
        {offers.map((offer) => (
          <article key={offer.id} className="rounded-2xl border border-he-border bg-he-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-he-soft">
                  {activeTab === 'incoming' ? 'Offer on your listing' : 'Your offer'}
                </p>
                <Link to={`/items/${offer.listing_id}`} className="text-base font-bold text-he-ink hover:text-he-purple">
                  {offer.listing_title}
                </Link>
                <p className="text-sm text-he-muted">
                  {activeTab === 'incoming' ? `From ${offer.offering_user_name}` : `To ${offer.owner_user_name}`}
                </p>
                {activeTab === 'incoming' ? (
                  <p className="text-[12px] font-semibold text-he-ink">{displayTransactionCity(offer.offering_user_city)}</p>
                ) : null}
              </div>
              <StatusBadge status={String(offer.status).toLowerCase()} />
            </div>

            <div className="mt-3 flex gap-3">
              <img
                src={offerImage(offer)}
                alt={offerTitle(offer)}
                className="h-16 w-16 rounded-lg object-cover"
                onError={(event) => { event.currentTarget.src = ITEM_PLACEHOLDER_URL }}
              />
              <div>
                <p className="text-sm font-bold text-he-ink">{offerTitle(offer)}</p>
                <p className="text-[12px] text-he-muted">{offer.message}</p>
                {offer.cash_adjustment != null ? (
                  <p className="text-[11px] font-bold text-he-purple">Cash adjustment: {offer.cash_adjustment}</p>
                ) : null}
              </div>
            </div>

            {activeTab === 'incoming' && offer.status === 'PENDING' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={actionId === offer.id} onClick={() => runAction(offer.id, 'accept')}>Accept</Button>
                <Button variant="secondary" disabled={actionId === offer.id} onClick={() => runAction(offer.id, 'decline')}>Decline</Button>
                <Button as="link" to={`/items/${offer.listing_id}`} variant="ghost">View listing</Button>
              </div>
            ) : null}

            {activeTab === 'incoming' && offer.status === 'COUNTERED' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <p className="w-full text-[12px] text-he-muted">Waiting for the offering user to accept this counter.</p>
                <Button variant="secondary" disabled={actionId === offer.id} onClick={() => runAction(offer.id, 'decline')}>Decline</Button>
                <Button as="link" to={`/items/${offer.listing_id}`} variant="ghost">View listing</Button>
              </div>
            ) : null}

            {activeTab === 'mine' && offer.status === 'COUNTERED' ? (
              <div className="mt-3">
                <Button disabled={actionId === offer.id} onClick={() => runAction(offer.id, 'accept-counter')}>
                  Accept counter offer
                </Button>
              </div>
            ) : null}

            {offer.transaction_id ? (
              <div className="mt-3">
                <Button as="link" to={`/exchange/${offer.transaction_id}`} variant="secondary">
                  View exchange progress
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  )
}
