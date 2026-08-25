import { useEffect, useState } from 'react'

import { Button, StatusBadge, TextAreaField, TextField } from './ui.jsx'
import { resolveItemImageUrl, ITEM_PLACEHOLDER_URL } from '../lib/itemImages.js'
import { apiUrl } from '../lib/api.js'
import { exchangeActionErrorMessage } from '../lib/exchangeErrors.js'
import { displayTransactionCity } from '../lib/locations.js'

function offerImage(offer) {
  if (offer.offered_listing_image) return resolveItemImageUrl(offer.offered_listing_image)
  if (offer.custom_item_image) return resolveItemImageUrl(offer.custom_item_image)
  return ITEM_PLACEHOLDER_URL
}

function offerTitle(offer) {
  return offer.offered_listing_title || offer.custom_item_title || 'Custom item'
}

export default function ExchangeOffersPanel({
  item,
  token,
  onUpdated,
}) {
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState('')
  const [counterOfferId, setCounterOfferId] = useState('')
  const [counterMessage, setCounterMessage] = useState('')
  const [counterCash, setCounterCash] = useState('')

  async function loadOffers() {
    if (!item?.id || !token) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(apiUrl(`/api/items/${item.id}/exchange-offers`), {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not load exchange offers.')
      setOffers(Array.isArray(data.offers) ? data.offers : [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOffers()
  }, [item?.id, token])

  async function runAction(offerId, action, body) {
    setActionId(offerId)
    setError('')
    try {
      const options = {
        method: action === 'counter' ? 'POST' : 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }
      const path = action === 'counter'
        ? `/api/exchange-offers/${offerId}/counter`
        : `/api/exchange-offers/${offerId}/${action}`
      const res = await fetch(apiUrl(path), options)
      let data = null
      try {
        data = await res.json()
      } catch {
        data = null
      }
      if (!res.ok) throw new Error(exchangeActionErrorMessage(res.status, data?.detail))
      setCounterOfferId('')
      setCounterMessage('')
      setCounterCash('')
      await loadOffers()
      onUpdated?.(data)
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setActionId('')
    }
  }

  if (!item) return null

  return (
    <section className="rounded-2xl border border-he-border bg-he-surface p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-he-purple">Exchange Offers</p>
          <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-he-ink">
            Exchange Offers ({offers.length})
          </h3>
        </div>
        {item.exchange_reserved || item.status === 'exchange_reserved' ? (
          <StatusBadge status="exchange_reserved" />
        ) : null}
      </div>

      {item.exchange_reserved || item.status === 'exchange_reserved' ? (
        <p className="mb-3 rounded-xl bg-[#f8edff] px-3 py-2 text-sm text-[#7340d2]">
          Exchange Reserved — giveaway requests are paused while this swap is being completed.
        </p>
      ) : null}

      {loading ? <p className="text-sm text-he-muted">Loading exchange offers…</p> : null}
      {error ? <p className="text-sm font-bold text-he-danger">{error}</p> : null}

      {!loading && offers.length === 0 ? (
        <p className="text-sm text-he-muted">No swap offers yet.</p>
      ) : null}

      <div className="space-y-3">
        {offers.map((offer) => (
          <article key={offer.id} className="rounded-xl border border-he-border p-3">
            <div className="flex gap-3">
              <img
                src={offerImage(offer)}
                alt={offerTitle(offer)}
                className="h-16 w-16 rounded-lg object-cover"
                onError={(event) => { event.currentTarget.src = ITEM_PLACEHOLDER_URL }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-he-ink">{offer.offering_user_name}</p>
                    <p className="text-[11px] font-semibold text-he-muted">{displayTransactionCity(offer.offering_user_city)}</p>
                  </div>
                  <StatusBadge status={String(offer.status).toLowerCase()} />
                </div>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-he-soft">Offering</p>
                <p className="text-sm text-he-ink">{offerTitle(offer)}</p>
                {offer.custom_item_condition || offer.offered_listing_title ? (
                  <p className="text-[11px] text-he-muted">
                    Condition: {offer.custom_item_condition || 'Listed item'}
                  </p>
                ) : null}
                {offer.custom_item_description ? (
                  <p className="mt-1 line-clamp-3 text-[12px] text-he-muted">{offer.custom_item_description}</p>
                ) : null}
                <p className="mt-1 text-[12px] text-he-muted">{offer.message}</p>
                {offer.cash_adjustment != null ? (
                  <p className="text-[11px] font-bold text-he-purple">Cash adjustment: {offer.cash_adjustment}</p>
                ) : null}
                {offer.counter_message ? (
                  <p className="mt-2 rounded-lg bg-he-surface-soft p-2 text-[12px] text-he-ink">
                    Counter: {offer.counter_message}
                    {offer.counter_cash_adjustment != null ? ` (+ ${offer.counter_cash_adjustment})` : ''}
                  </p>
                ) : null}
              </div>
            </div>

            {offer.status === 'PENDING' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={actionId === offer.id}
                  onClick={() => runAction(offer.id, 'accept')}
                >
                  Accept
                </Button>
                <Button
                  variant="secondary"
                  disabled={actionId === offer.id}
                  onClick={() => runAction(offer.id, 'decline')}
                >
                  Decline
                </Button>
                <Button
                  variant="ghost"
                  disabled={actionId === offer.id}
                  onClick={() => setCounterOfferId((current) => (current === offer.id ? '' : offer.id))}
                >
                  Counter
                </Button>
              </div>
            ) : null}

            {offer.status === 'COUNTERED' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <p className="w-full text-[12px] text-he-muted">Waiting for the offering user to accept this counter.</p>
                <Button
                  variant="secondary"
                  disabled={actionId === offer.id}
                  onClick={() => runAction(offer.id, 'decline')}
                >
                  Decline
                </Button>
                <Button
                  variant="ghost"
                  disabled={actionId === offer.id}
                  onClick={() => setCounterOfferId((current) => (current === offer.id ? '' : offer.id))}
                >
                  Counter
                </Button>
              </div>
            ) : null}

            {counterOfferId === offer.id ? (
              <div className="mt-3 space-y-2 rounded-xl border border-dashed border-he-border p-3">
                <TextAreaField
                  label="Counter message"
                  value={counterMessage}
                  onChange={(event) => setCounterMessage(event.target.value)}
                  rows={3}
                />
                <TextField
                  label="Optional cash adjustment"
                  value={counterCash}
                  onChange={(event) => setCounterCash(event.target.value)}
                />
                <Button
                  disabled={actionId === offer.id}
                  onClick={() => runAction(offer.id, 'counter', {
                    message: counterMessage,
                    cash_adjustment: counterCash.trim() ? Number(counterCash) : null,
                  })}
                >
                  Send Counter Offer
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
