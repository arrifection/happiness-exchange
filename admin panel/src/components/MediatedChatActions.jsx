import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Wrench } from 'lucide-react'

import { adminConversationsApi } from '../lib/api'
import { resolveApiError } from '../lib/backend'
import { buildMessagesUrl, canOpenMediatedChat } from '../lib/messagesNavigation'

export default function MediatedChatActions({
  requestId,
  requestStatus,
  itemId,
  compact = false,
}) {
  const navigate = useNavigate()
  const [exchange, setExchange] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [repairing, setRepairing] = useState(false)

  const canChat = canOpenMediatedChat(requestStatus)

  useEffect(() => {
    if (!canChat) {
      setExchange(null)
      return undefined
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const params = { limit: 10, repair_missing: true }
        if (requestId) params.request_id = requestId
        else if (itemId) params.item_id = itemId

        const res = await adminConversationsApi.listExchanges(params)
        const rows = res.data?.exchanges || []
        const match = requestId
          ? rows.find((row) => row.request_id === requestId)
          : rows.find((row) => row.item_id === itemId) || rows[0]
        if (!cancelled) setExchange(match || null)
      } catch (err) {
        if (!cancelled) setError(resolveApiError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [canChat, requestId, itemId])

  if (!canChat) {
    return (
      <p className="text-sm text-surface-500 italic">
        Chats become available after approval.
      </p>
    )
  }

  async function handleRepair() {
    const id = exchange?.request_id || requestId
    if (!id) return
    setRepairing(true)
    setError('')
    try {
      await adminConversationsApi.repair(id)
      const res = await adminConversationsApi.listExchanges({
        limit: 10,
        repair_missing: true,
        request_id: id,
      })
      setExchange((res.data?.exchanges || []).find((row) => row.request_id === id) || null)
    } catch (err) {
      setError(resolveApiError(err))
    } finally {
      setRepairing(false)
    }
  }

  const wrapperClass = compact ? 'space-y-2' : 'rounded-lg border border-surface-300 bg-surface-50 p-4 space-y-3'

  return (
    <div className={wrapperClass}>
      <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" />
        Admin-mediated chats
      </p>

      {loading ? (
        <p className="text-sm text-surface-500">Loading chat links…</p>
      ) : (
        <>
          {exchange ? (
            <p className="text-xs text-surface-500">
              Request {exchange.request_id} · {exchange.requester_name} ↔ admin ↔ {exchange.owner_name}
            </p>
          ) : (
            <p className="text-sm text-surface-500">No approved exchange found for this listing yet.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={!exchange?.receiver_chat}
              onClick={() => navigate(buildMessagesUrl({
                requestId: exchange?.request_id || requestId,
                chat: 'receiver',
              }))}
            >
              Open Receiver Chat
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={!exchange?.lister_chat}
              onClick={() => navigate(buildMessagesUrl({
                requestId: exchange?.request_id || requestId,
                chat: 'lister',
              }))}
            >
              Open Lister Chat
            </button>
            {(exchange?.needs_repair || !exchange?.receiver_chat || !exchange?.lister_chat) && (exchange?.request_id || requestId) ? (
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={repairing}
                onClick={handleRepair}
              >
                <Wrench className="w-3.5 h-3.5" />
                {repairing ? 'Repairing…' : 'Repair Admin Chats'}
              </button>
            ) : null}
          </div>
        </>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
