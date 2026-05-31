import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function StatCard({ label, value, icon: Icon, trend, sub, color = 'brand', to }) {
  const colorMap = {
    brand:   { bg: 'bg-brand-50',   icon: 'text-brand-600',   ring: 'ring-brand-200' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'ring-emerald-200' },
    amber:   { bg: 'bg-accent-50',  icon: 'text-accent-600',  ring: 'ring-accent-200' },
    red:     { bg: 'bg-red-50',     icon: 'text-red-600',     ring: 'ring-red-200' },
    purple:  { bg: 'bg-purple-50',  icon: 'text-purple-600',  ring: 'ring-purple-200' },
  }
  const c = colorMap[color] || colorMap.brand

  const isTrendUp   = trend?.startsWith('+')
  const isTrendDown = trend?.startsWith('-')

  const body = (
    <>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${c.bg} ${c.ring}`}>
          {Icon && <Icon className={`w-5 h-5 ${c.icon}`} />}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full
            ${isTrendUp   ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
              isTrendDown ? 'bg-red-50 text-red-700 ring-1 ring-red-200' :
              'bg-surface-100 text-surface-600 ring-1 ring-surface-300'}`
          }>
            {isTrendUp   ? <TrendingUp  className="w-3 h-3" /> :
             isTrendDown ? <TrendingDown className="w-3 h-3" /> :
             <Minus className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-surface-800 tracking-tight">{value ?? '—'}</p>
        <p className="text-sm font-medium text-surface-600 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-surface-500 mt-1">{sub}</p>}
      </div>
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="stat-card stat-card-link block focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
      >
        {body}
      </Link>
    )
  }

  return <div className="stat-card">{body}</div>
}
