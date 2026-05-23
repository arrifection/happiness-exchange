import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

/**
 * StatCard — dashboard KPI card
 * @param {object} props
 * @param {string}  props.label
 * @param {string|number} props.value
 * @param {React.ElementType} props.icon
 * @param {string}  [props.trend]   — '+12%' or '-5%' or '0%'
 * @param {string}  [props.sub]     — subtitle text
 * @param {string}  [props.color]   — 'brand' | 'emerald' | 'amber' | 'red' | 'purple'
 */
export default function StatCard({ label, value, icon: Icon, trend, sub, color = 'brand' }) {
  const colorMap = {
    brand:   { bg: 'bg-brand-500/10',   icon: 'text-brand-400',   ring: 'ring-brand-500/20' },
    emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', ring: 'ring-emerald-500/20' },
    amber:   { bg: 'bg-amber-500/10',   icon: 'text-amber-400',   ring: 'ring-amber-500/20' },
    red:     { bg: 'bg-red-500/10',     icon: 'text-red-400',     ring: 'ring-red-500/20' },
    purple:  { bg: 'bg-purple-500/10',  icon: 'text-purple-400',  ring: 'ring-purple-500/20' },
  }
  const c = colorMap[color] || colorMap.brand

  const isTrendUp   = trend?.startsWith('+')
  const isTrendDown = trend?.startsWith('-')

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${c.bg} ${c.ring}`}>
          {Icon && <Icon className={`w-5 h-5 ${c.icon}`} />}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full
            ${isTrendUp   ? 'bg-emerald-500/10 text-emerald-400' :
              isTrendDown ? 'bg-red-500/10 text-red-400' :
              'bg-surface-700/50 text-surface-500'}`
          }>
            {isTrendUp   ? <TrendingUp  className="w-3 h-3" /> :
             isTrendDown ? <TrendingDown className="w-3 h-3" /> :
             <Minus className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-surface-50 tracking-tight">{value ?? '—'}</p>
        <p className="text-sm text-surface-400 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-surface-600 mt-1">{sub}</p>}
      </div>
    </div>
  )
}
