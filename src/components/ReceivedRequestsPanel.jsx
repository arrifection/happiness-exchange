import { useEffect, useState } from 'react'

import IncomingRequestReview from './IncomingRequestReview.jsx'
import { Button, StatusBadge } from './ui.jsx'
import { apiUrl, asArray } from '../lib/api.js'

export default function ReceivedRequestsPanel({ item, token, onRequestAction, onUpdated }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState('')

  async function loadRequests() {
    if (!item?.id || !token) return
    setLoading(true)
    setError('')
    try {
      // Owner-only endpoint: the public listing payload never carries requests.
      const res = await fetch(apiUrl(`/api/items/${item.id}/requests`), {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Could not load received requests.')
      setRequests(asArray(data))
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [item?.id, token])

  async function runAction(requestId, action) {
    setActionId(requestId)
    setError('')
    try {
      const result = await onRequestAction?.(requestId, action)
      if (result === null) {
        setError('Could not update this request. Please try again.')
      }
      await loadRequests()
      onUpdated?.(result)
    } finally {
      setActionId('')
    }
  }

  if (!item) return null

  return (
    <section className="rounded-2xl border border-he-border bg-he-surface p-4 md:p-5">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-he-purple">Private to you</p>
        <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-he-ink">
          Received Requests ({requests.length})
        </h3>
      </div>

      {loading ? <p className="text-sm text-he-muted">Loading received requests…</p> : null}
      {error ? <p className="text-sm font-bold text-he-danger">{error}</p> : null}

      {!loading && !error && requests.length === 0 ? (
        <p className="text-sm text-he-muted">No requests for this listing yet.</p>
      ) : null}

      <div className="space-y-3">
        {requests.map((request) => (
          <article key={request.id} className="rounded-xl border border-he-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-bold text-he-ink">{request.requester_name}</p>
              <StatusBadge status={request.status} />
            </div>

            <IncomingRequestReview request={request} />

            {request.status === 'pending' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={actionId === request.id}
                  onClick={() => runAction(request.id, 'approve')}
                >
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  disabled={actionId === request.id}
                  onClick={() => runAction(request.id, 'reject')}
                >
                  Decline
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
