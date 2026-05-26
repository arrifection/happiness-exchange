import { TRUST_LEVELS, getLevelProgress, normalizeTrustLevel } from '../lib/trustLevels.js'

export default function TrustLevelLadder({ level, trustScore = 0, compact = false, className = '' }) {
  const normalizedLevel = normalizeTrustLevel(level)
  const progress = getLevelProgress(trustScore, normalizedLevel)

  return (
    <div className={className}>
      <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {TRUST_LEVELS.map((entry) => {
          const isCurrent = entry.name === normalizedLevel
          const isComplete = trustScore >= entry.minPoints && !isCurrent
          const isUpcoming = trustScore < entry.minPoints

          return (
            <div
              key={entry.name}
              className={[
                'relative rounded-2xl border px-3 py-3 text-center transition-all',
                isCurrent
                  ? 'border-he-purple/40 bg-he-purple/10 shadow-sm ring-1 ring-he-purple/20 dark:bg-he-purple/15'
                  : isComplete
                    ? 'border-he-border bg-he-surface-soft opacity-90 dark:bg-he-elevated/70'
                    : 'border-dashed border-he-border bg-he-surface-soft/60 opacity-70 dark:bg-he-elevated/40',
              ].join(' ')}
            >
              {isCurrent ? (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-he-purple px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white">
                  Current
                </span>
              ) : null}
              <div className={`${compact ? 'text-xl' : 'text-2xl'}`}>{entry.icon}</div>
              <p className={`mt-1 font-bold text-he-ink ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
                {entry.name}
              </p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-he-muted">
                {entry.minPoints}+ pts
              </p>
              {isUpcoming && progress.nextLevel === entry.name ? (
                <p className="mt-1 text-[9px] font-bold text-he-purple">
                  {progress.pointsToNext} to go
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
