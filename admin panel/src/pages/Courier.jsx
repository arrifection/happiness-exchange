import { useState, useEffect } from 'react'
import { Truck, Package, MapPin, Phone, Clock, CheckCircle, AlertCircle, RefreshCw, Upload, Image as ImageIcon } from 'lucide-react'
import { deliveriesApi } from '../lib/api'

const statusConfig = {
  awaiting_dropoff_address: { badge: 'badge-yellow', icon: Clock,        label: 'Awaiting Address' },
  ready_for_courier:        { badge: 'badge-yellow', icon: Package,      label: 'Ready for Courier'},
  assigned:                 { badge: 'badge-blue',   icon: Truck,        label: 'Assigned' },
  picked_up:                { badge: 'badge-blue',   icon: Truck,        label: 'Picked Up' },
  in_transit:               { badge: 'badge-blue',   icon: Truck,        label: 'In Transit'  },
  delivered:                { badge: 'badge-green',  icon: CheckCircle,  label: 'Delivered'   },
  completed:                { badge: 'badge-green',  icon: CheckCircle,  label: 'Completed'   },
  failed:                   { badge: 'badge-red',    icon: AlertCircle,  label: 'Failed'      },
}

export default function CourierPage() {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    fetchDeliveries()
  }, [])

  const fetchDeliveries = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await deliveriesApi.list()
      setDeliveries(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch deliveries')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (id, newStatus) => {
    setUpdating(id)
    try {
      const res = await deliveriesApi.updateStatus(id, newStatus)
      setDeliveries((prev) => prev.map((d) => d.id === id ? res.data : d))
    } catch (err) {
      alert(err.response?.data?.detail || 'Update failed')
    } finally {
      setUpdating(null)
    }
  }

  const handleUploadProof = async (id, file) => {
    if (!file) return
    setUpdating(id)
    try {
      const res = await deliveriesApi.uploadProof(id, file)
      setDeliveries((prev) => prev.map((d) => d.id === id ? res.data : d))
      alert('Proof of delivery uploaded.')
    } catch (err) {
      alert(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUpdating(null)
    }
  }

  const filtered = filter === 'all' 
    ? deliveries 
    : deliveries.filter((d) => {
        if (filter === 'active') return ['assigned', 'picked_up', 'in_transit'].includes(d.status)
        if (filter === 'pending') return ['ready_for_courier', 'awaiting_dropoff_address'].includes(d.status)
        return d.status === filter
      })

  const activeCount    = deliveries.filter((d) => ['assigned', 'picked_up', 'in_transit'].includes(d.status)).length
  const pendingCount   = deliveries.filter((d) => ['ready_for_courier', 'awaiting_dropoff_address'].includes(d.status)).length
  const deliveredCount = deliveries.filter((d) => ['delivered', 'completed'].includes(d.status)).length

  return (
    <div className="animate-slide-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h2 className="page-title">Courier Coordination</h2>
          <p className="page-subtitle">Secure dispatch and encrypted address routing</p>
        </div>
        <button onClick={fetchDeliveries} className="btn-secondary px-3 py-1.5 flex items-center gap-2">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && <p className="mb-4 text-xs font-bold text-red-600 bg-red-400/10 p-3 rounded-lg">{error}</p>}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Active',      value: activeCount,    icon: Truck,       color: 'text-brand-600',   bg: 'bg-brand-500/10',   ring: 'ring-brand-500/20' },
          { label: 'Pending',     value: pendingCount,   icon: Clock,       color: 'text-accent-600',   bg: 'bg-amber-500/10',   ring: 'ring-amber-500/20' },
          { label: 'Completed',   value: deliveredCount, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
        ].map(({ label, value, icon: Icon, color, bg, ring }) => (
          <div key={label} className="card-sm flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} ring-1 ${ring} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-surface-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5 p-1 bg-white border border-surface-300 rounded-xl w-fit shadow-soft">
        {['all', 'pending', 'active', 'delivered'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              filter === f ? 'bg-brand-600 text-white shadow-sm' : 'text-surface-600 hover:text-surface-800'
            }`}
          >
            {f === 'active' ? 'In Transit' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Delivery cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filtered.map((d) => {
          const s = statusConfig[d.status] || statusConfig.failed
          return (
            <div key={d.id} className="card hover:border-surface-300 transition-all duration-200">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-surface-600">#{d.id.slice(-6)}</span>
                    <span className={`badge ${s.badge}`}>
                      <s.icon className="w-3 h-3" />
                      {s.label}
                    </span>
                  </div>
                  <p className="font-semibold text-surface-800">{d.item_title}</p>
                </div>
                
                {/* Actions */}
                <div className="flex gap-2">
                  {d.status === 'ready_for_courier' && (
                    <button disabled={updating === d.id} onClick={() => handleUpdateStatus(d.id, 'assigned')} className="btn-primary text-xs py-1.5 px-3">
                      Accept Task
                    </button>
                  )}
                  {d.status === 'assigned' && (
                    <button disabled={updating === d.id} onClick={() => handleUpdateStatus(d.id, 'picked_up')} className="btn-primary text-xs py-1.5 px-3">
                      Mark Picked Up
                    </button>
                  )}
                  {d.status === 'picked_up' && (
                    <button disabled={updating === d.id} onClick={() => handleUpdateStatus(d.id, 'in_transit')} className="btn-primary text-xs py-1.5 px-3">
                      In Transit
                    </button>
                  )}
                  {d.status === 'in_transit' && (
                    <button disabled={updating === d.id} onClick={() => handleUpdateStatus(d.id, 'delivered')} className="btn-success text-xs py-1.5 px-3">
                      <CheckCircle className="w-3 h-3" />
                      Mark Delivered
                    </button>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm mt-3 pt-4 border-t border-surface-300">
                {/* Pickup details */}
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold tracking-wider text-surface-500 uppercase mb-1">Pickup (Giver)</p>
                    <p className="text-surface-800 text-xs font-medium">{d.pickup_address}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Phone className="w-3 h-3 text-surface-600" />
                      <p className="text-surface-600 text-xs">{d.pickup_contact_number}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock className="w-3 h-3 text-surface-600" />
                      <p className="text-surface-600 text-xs">{d.pickup_preferred_time}</p>
                    </div>
                    {d.pickup_notes && <p className="text-surface-500 text-[10px] mt-1 bg-surface-100 p-1 rounded">Note: {d.pickup_notes}</p>}
                  </div>
                </div>

                {/* Dropoff details */}
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold tracking-wider text-brand-500 uppercase mb-1">Dropoff (Receiver)</p>
                    <p className="text-surface-800 text-xs font-medium">{d.dropoff_address || 'Pending...'}</p>
                    {d.receiver_contact_number && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Phone className="w-3 h-3 text-surface-600" />
                        <p className="text-surface-600 text-xs">{d.receiver_contact_number}</p>
                      </div>
                    )}
                    {d.dropoff_preferred_time && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Clock className="w-3 h-3 text-surface-600" />
                        <p className="text-surface-600 text-xs">{d.dropoff_preferred_time}</p>
                      </div>
                    )}
                    {d.dropoff_notes && <p className="text-surface-500 text-[10px] mt-1 bg-surface-100 p-1 rounded">Note: {d.dropoff_notes}</p>}
                  </div>
                </div>
              </div>

              {/* Proof of Delivery */}
              {(d.status === 'delivered' || d.status === 'completed') && (
                <div className="mt-4 pt-4 border-t border-surface-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-surface-500" />
                    <span className="text-xs text-surface-600">Proof of Delivery:</span>
                  </div>
                  {d.proof_of_delivery_url ? (
                    <a href={d.proof_of_delivery_url} target="_blank" rel="noreferrer" className="text-brand-600 text-xs hover:underline">View Image</a>
                  ) : (
                    <label className="btn-secondary text-[10px] py-1 px-2 cursor-pointer flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      Upload Photo
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleUploadProof(d.id, e.target.files[0])}
                        disabled={updating === d.id}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-surface-500 text-sm">
            No deliveries found for this filter.
          </div>
        )}
      </div>
    </div>
  )
}
