import React from 'react'

export default function LevelProgressBar({ currentLevel, trustScore, nextLevelPts, className = '' }) {
  if (!nextLevelPts) {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex justify-between text-[10px] font-bold text-[#8c755f]">
          <span>{currentLevel}</span>
          <span className="text-[#8b4cf6]">Max Level Reached! 🏆</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#efe8da]">
          <div className="h-full rounded-full bg-[#8b4cf6] w-full" />
        </div>
      </div>
    )
  }

  const progressPct = Math.min(100, Math.max(0, (trustScore / nextLevelPts) * 100))

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between text-[10px] font-bold text-[#8c755f]">
        <span>{currentLevel}</span>
        <span>Next: {nextLevelPts} pts</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#efe8da]">
        <div
          className="h-full rounded-full bg-[#ffcc22] transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  )
}
