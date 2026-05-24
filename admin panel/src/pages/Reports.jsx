import { useState } from 'react'
import { Flag, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'
import { EmptyState } from '../components/States'

// Placeholder page — reports API endpoint to be wired when backend exposes /api/reports
const MOCK_REPORTS = [
  { id: '1', type: 'Inappropriate Content', item: 'Old sofa (damaged)', reporter: 'user_abc', status: 'open',     date: '2026-05-20' },
  { id: '2', type: 'Spam Listing',          item: 'iPhone 99 Pro',      reporter: 'user_xyz', status: 'resolved', date: '2026-05-18' },
  { id: '3', type: 'Fraudulent User',       item: 'N/A',                reporter: 'user_def', status: 'open',     date: '2026-05-17' },
  { id: '4', type: 'Offensive Language',    item: 'Request #1234',      reporter: 'user_ghi', status: 'reviewing', date: '2026-05-15' },
]

const statusBadge = { open: 'badge-red', reviewing: 'badge-yellow', resolved: 'badge-green' }
const statusIcon  = {
  open:      <AlertTriangle className="w-3.5 h-3.5" />,
  reviewing: <Clock         className="w-3.5 h-3.5" />,
  resolved:  <CheckCircle   className="w-3.5 h-3.5" />,
}

export default function ReportsPage() {
  const [reports, setReports] = useState(MOCK_REPORTS)
  const [filter, setFilter]   = useState('all')

  const filtered = filter === 'all' ? reports : reports.filter((r) => r.status === filter)

  const resolve = (id) => setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: 'resolved' } : r))
  const dismiss = (id) => setReports((prev) => prev.filter((r) => r.id !== id))

  const openCount     = reports.filter((r) => r.status === 'open').length
  const reviewingCount = reports.filter((r) => r.status === 'reviewing').length

  return (
    <div className="animate-slide-in">
      <div className="page-header">
        <h2 className="page-title">Reports & Flags</h2>
        <p className="page-subtitle">Content moderation and user reports</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Open Reports',  value: openCount,     color: 'text-red-600',    bg: 'bg-red-500/10',    ring: 'ring-red-500/20'    },
          { label: 'Under Review',  value: reviewingCount, color: 'text-accent-600', bg: 'bg-amber-500/10',  ring: 'ring-amber-500/20'  },
          { label: 'Resolved',      value: reports.filter((r) => r.status === 'resolved').length, color: 'text-emerald-600', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
        ].map(({ label, value, color, bg, ring }) => (
          <div key={label} className="card-sm flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} ring-1 ${ring} flex items-center justify-center`}>
              <Flag className={`w-4 h-4 ${color}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-surface-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5 p-1 bg-white border border-surface-300 rounded-xl w-fit shadow-soft">
        {['all', 'open', 'reviewing', 'resolved'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              filter === f
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-surface-600 hover:text-surface-800'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Reports table */}
      <div className="card p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Flag} title="No reports" description="All clear! No reports match this filter." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Related Item</th>
                  <th>Reporter</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-surface-800">{r.type}</td>
                    <td className="text-surface-600">{r.item}</td>
                    <td className="font-mono text-xs text-surface-500">{r.reporter}</td>
                    <td>
                      <span className={`badge ${statusBadge[r.status] || 'badge-gray'} gap-1`}>
                        {statusIcon[r.status]}
                        {r.status}
                      </span>
                    </td>
                    <td className="text-surface-500 text-xs">{r.date}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {r.status !== 'resolved' && (
                          <button onClick={() => resolve(r.id)} className="btn-success text-xs py-1 px-2">
                            <CheckCircle className="w-3 h-3" />
                            Resolve
                          </button>
                        )}
                        <button onClick={() => dismiss(r.id)} className="btn-ghost text-xs py-1 px-2">
                          <XCircle className="w-3 h-3" />
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
