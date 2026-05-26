import { getTrustLevelMeta, getTrustPointsTooltip, normalizeTrustLevel } from '../lib/trustLevels.js'

const SIZE_STYLES = {
  sm: {
    wrap: 'gap-1 px-2 py-0.5 text-[9px]',
    icon: 'text-[11px]',
    points: 'text-[8px]',
  },
  md: {
    wrap: 'gap-1.5 px-2.5 py-1 text-[10px]',
    icon: 'text-[13px]',
    points: 'text-[9px]',
  },
}

export default function TrustBadge({
  level,
  trustScore = 0,
  nextLevelPoints,
  showPoints = true,
  size = 'md',
  className = '',
}) {
  const normalizedLevel = normalizeTrustLevel(level)
  const meta = getTrustLevelMeta(normalizedLevel)
  const palette = meta.light
  const tooltip = getTrustPointsTooltip({ level: normalizedLevel, trustScore, nextLevelPoints })
  const styles = SIZE_STYLES[size] || SIZE_STYLES.md

  return (
    <div
      className={`group relative inline-flex max-w-full items-center ${className}`}
      title={tooltip}
    >
      <div
        className={`inline-flex max-w-full items-center rounded-full border font-bold shadow-sm transition-all ${styles.wrap}`}
        style={{
          backgroundColor: palette.bg,
          borderColor: palette.border,
          color: palette.color,
        }}
      >
        <span className={styles.icon} aria-hidden="true">
          {meta.icon}
        </span>
        <span className="truncate">{normalizedLevel}</span>
        {showPoints ? (
          <span className={`rounded-full bg-white/70 px-1.5 py-0.5 font-extrabold ${styles.points} dark:bg-black/20`}>
            {trustScore} pts
          </span>
        ) : null}
      </div>
      <div
        role="tooltip"
        className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-20 hidden w-56 rounded-xl border border-he-border bg-he-surface p-2.5 text-left shadow-lg group-hover:block group-focus-within:block dark:bg-he-elevated"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-he-purple">Trust Points</p>
        <p className="mt-1 text-[11px] leading-relaxed text-he-muted">{tooltip}</p>
      </div>
    </div>
  )
}
