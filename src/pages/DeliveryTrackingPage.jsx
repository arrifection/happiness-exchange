import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, StatusBadge, Surface } from '../components/ui.jsx'

function DeliveryTimeline({ status, isGiver }) {
  const steps = [
    { key: 'awaiting_pickup_address', label: 'Pickup Added', activeAt: ['awaiting_dropoff_address', 'ready_for_courier', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed'] },
    { key: 'awaiting_dropoff_address', label: 'Drop-off Added', activeAt: ['ready_for_courier', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed'] },
    { key: 'ready_for_courier', label: 'Ready for Courier', activeAt: ['ready_for_courier', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed'] },
    { key: 'assigned', label: 'Courier Assigned', activeAt: ['assigned', 'picked_up', 'in_transit', 'delivered', 'completed'] },
    { key: 'picked_up', label: 'Picked Up', activeAt: ['picked_up', 'in_transit', 'delivered', 'completed'] },
    { key: 'in_transit', label: 'In Transit', activeAt: ['in_transit', 'delivered', 'completed'] },
    { key: 'delivered', label: 'Delivered', activeAt: ['delivered', 'completed'] },
  ]

  return (
    <div className="relative mt-8">
      <div className="absolute left-3 top-0 h-full w-0.5 bg-[#efe8da]" />
      <div className="space-y-6">
        {steps.map((step, index) => {
          const isCompleted = step.activeAt.includes(status)
          const isCurrent = status === step.key || (status === 'awaiting_dropoff_address' && step.key === 'awaiting_pickup_address')
          return (
            <div key={step.key} className="relative flex items-start gap-4">
              <div
                className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white transition-colors
                ${isCompleted ? 'border-[#8b4cf6] bg-[#8b4cf6]' : isCurrent ? 'border-[#8b4cf6]' : 'border-[#efe8da]'}`}
              >
                {isCompleted && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {isCurrent && !isCompleted && (
                  <div className="h-2 w-2 rounded-full bg-[#8b4cf6]" />
                )}
              </div>
              <div className="pt-0.5">
                <p className={`text-sm font-bold tracking-tight ${isCompleted || isCurrent ? 'text-[#1f1f1f]' : 'text-[#8c755f]/60'}`}>
                  {step.label}
                </p>
                {isCurrent && step.key === 'ready_for_courier' && (
                  <p className="mt-1 text-xs text-[#68766d]">Waiting for a courier to accept this delivery.</p>
                )}
                {isCurrent && step.key === 'in_transit' && (
                  <p className="mt-1 text-xs text-[#68766d]">Courier is on the way!</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function DeliveryTrackingPage({ token, currentUser }) {
  const { deliveryId } = useParams()
  const navigate = useNavigate()
  const [delivery, setDelivery] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    loadDelivery()
  }, [deliveryId])

  async function loadDelivery() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/deliveries/${deliveryId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setDelivery(data)
      } else {
        setError(data.detail || 'Could not load delivery.')
      }
    } catch (err) {
      setError('Connection error.')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmCompletion() {
    setConfirming(true)
    setActionError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/deliveries/${deliveryId}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setDelivery(data)
      } else {
        setActionError(typeof data.detail === 'string' ? data.detail : 'Could not confirm delivery.')
      }
    } catch {
      setActionError('Error confirming delivery. Please try again.')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#68766d]">Loading Delivery...</p>
      </div>
    )
  }

  if (error || !delivery) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Surface className="p-6">
          <p className="font-bold text-[#c65d4a]">{error || 'Delivery not found'}</p>
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </Surface>
      </div>
    )
  }

  const isGiver = delivery.giver_id === currentUser?.id

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-6 h-8 text-[11px]">
        ← Back to Dashboard
      </Button>

      <Surface className="overflow-hidden p-0">
        <div className="bg-[#faf7f1] p-6 border-b border-[#efe8da]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Delivery For</p>
              <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold tracking-tight text-[#1f1f1f]">
                {delivery.item_title}
              </h1>
            </div>
            <StatusBadge status={delivery.status} />
          </div>
          <p className="mt-3 rounded-lg bg-[#efe7ff] p-3 text-xs leading-relaxed text-[#8b4cf6] font-medium shadow-sm">
            🛡️ Privacy Protected: Your exact address is never shown to the other party. Only authorized couriers can access delivery details.
          </p>
        </div>

        <div className="p-6">
          <DeliveryTimeline status={delivery.status} isGiver={isGiver} />

          {delivery.proof_of_delivery_url && (
            <div className="mt-8 rounded-xl border border-[#efe8da] p-4 bg-[#faf7f1]/50">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#1f1f1f]">Proof of Delivery</h3>
              <a href={delivery.proof_of_delivery_url} target="_blank" rel="noreferrer" className="block max-w-xs overflow-hidden rounded-lg shadow-sm">
                <img src={delivery.proof_of_delivery_url} alt="Proof of delivery" className="w-full object-cover" />
              </a>
            </div>
          )}

          {delivery.status === 'delivered' && (
            <div className="mt-8 border-t border-[#efe8da] pt-6">
              <div className="rounded-xl bg-[#fffdfb] border border-[#efe8da] p-5 text-center shadow-xs">
                <h3 className="text-sm font-bold text-[#1f1f1f]">Item Delivered!</h3>
                <p className="mt-1 text-xs text-[#68766d]">Please confirm you are satisfied with this delivery.</p>
                {actionError ? (
                  <p className="mt-3 text-[11px] font-medium text-[#c65d4a]">{actionError}</p>
                ) : null}
                <Button
                  onClick={handleConfirmCompletion} 
                  disabled={confirming}
                  className="mt-4 w-full bg-[#8b4cf6] text-white sm:w-auto"
                >
                  {confirming ? 'Confirming...' : 'Complete Delivery'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Surface>
    </div>
  )
}
