import { useState } from 'react'
import { Button } from '../ui.jsx'

export function ArrangeDeliveryModal({ request, token, onComplete, onCancel }) {
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!address || !phone || !time) {
      setError('Address, contact number, and preferred time are required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/deliveries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          request_id: request.id,
          pickup_address: address,
          pickup_contact_number: phone,
          pickup_preferred_time: time,
          pickup_notes: notes
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to arrange delivery.')
      onComplete(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1f1f1f]/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-xl">
        <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold tracking-tight text-[#1f1f1f]">Arrange Courier Delivery</h2>
        <p className="mt-1 text-xs text-[#68766d]">
          Your address is encrypted and only visible to authorized couriers. The receiver will never see it.
        </p>

        {error && <p className="mt-3 rounded bg-red-50 p-2 text-xs font-bold text-red-600">{error}</p>}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Pickup Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 px-4 py-2.5 text-sm transition focus:border-[#8b4cf6] focus:bg-white focus:outline-none"
              placeholder="Full street address and city"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Contact Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 px-4 py-2.5 text-sm transition focus:border-[#8b4cf6] focus:bg-white focus:outline-none"
              placeholder="e.g. +1 555-0192"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Preferred Pickup Time</label>
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 px-4 py-2.5 text-sm transition focus:border-[#8b4cf6] focus:bg-white focus:outline-none"
              placeholder="e.g. Tomorrow between 2 PM - 5 PM"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Optional Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full resize-none rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 px-4 py-2.5 text-sm transition focus:border-[#8b4cf6] focus:bg-white focus:outline-none"
              rows={2}
              placeholder="Gate code, instructions..."
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-[#8b4cf6] text-white">
              {loading ? 'Submitting...' : 'Submit Pickup Info'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AddDeliveryAddressModal({ delivery, token, onComplete, onCancel }) {
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!address || !phone || !time) {
      setError('Address, contact number, and preferred time are required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/deliveries/${delivery.id}/dropoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          dropoff_address: address,
          receiver_contact_number: phone,
          dropoff_preferred_time: time,
          dropoff_notes: notes
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to submit dropoff address.')
      onComplete(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1f1f1f]/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-xl">
        <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold tracking-tight text-[#1f1f1f]">Add Delivery Address</h2>
        <p className="mt-1 text-xs text-[#68766d]">
          The giver has requested courier delivery. Your address is encrypted and only visible to authorized couriers.
        </p>

        {error && <p className="mt-3 rounded bg-red-50 p-2 text-xs font-bold text-red-600">{error}</p>}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Delivery Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 px-4 py-2.5 text-sm transition focus:border-[#8b4cf6] focus:bg-white focus:outline-none"
              placeholder="Full street address and city"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Contact Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 px-4 py-2.5 text-sm transition focus:border-[#8b4cf6] focus:bg-white focus:outline-none"
              placeholder="e.g. +1 555-0192"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Preferred Dropoff Time</label>
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 px-4 py-2.5 text-sm transition focus:border-[#8b4cf6] focus:bg-white focus:outline-none"
              placeholder="e.g. Weekdays after 6 PM"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Optional Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full resize-none rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 px-4 py-2.5 text-sm transition focus:border-[#8b4cf6] focus:bg-white focus:outline-none"
              rows={2}
              placeholder="Gate code, instructions..."
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-[#8b4cf6] text-white">
              {loading ? 'Submitting...' : 'Submit Delivery Info'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
