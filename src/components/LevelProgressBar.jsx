import { getLevelProgress, normalizeTrustLevel } from '../lib/trustLevels.js'

export default function LevelProgressBar({
  currentLevel,
  trustScore = 0,
  nextLevelPts,
  className = '',
}) {
  const normalizedLevel = normalizeTrustLevel(currentLevel)
  const progress = getLevelProgress(trustScore, normalizedLevel)
  const targetPoints = nextLevelPts ?? progress.nextLevelPoints

  if (!targetPoints) {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex justify-between gap-2 text-[10px] font-bold text-he-soft">
          <span className="truncate text-he-ink">{normalizedLevel}</span>
          <span className="shrink-0 text-he-purple">Max level reached 🏆</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-he-border/70">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-he-purple to-[#7340d2]" />
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between gap-2 text-[10px] font-bold text-he-soft">
        <span className="truncate text-he-ink">{normalizedLevel}</span>
        <span className="shrink-0">
          {progress.pointsToNext} pts to {progress.nextLevel}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-he-border/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-he-yellow to-[#f59e0b] transition-all duration-700"
          style={{ width: `${progress.progressPct}%` }}
        />
      </div>
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-he-muted">
        {trustScore} / {targetPoints} trust points
      </p>
    </div>
  )
}
