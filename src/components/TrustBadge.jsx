import React from 'react'

const LEVEL_DATA = {
  'New Member': { icon: '🌱', color: '#68766d', bg: '#f0fdf4', border: '#bbf7d0' },
  'Trusted Sharer': { icon: '🤝', color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc' },
  'Community Helper': { icon: '⭐', color: '#8b4cf6', bg: '#efe7ff', border: '#c084fc' },
  'Kindness Champion': { icon: '🏆', color: '#c65d4a', bg: '#fef2f2', border: '#fca5a5' },
  'Elite Donor': { icon: '👑', color: '#7c3aed', bg: '#f5f3ff', border: '#8b4cf6' },
}

export default function TrustBadge({ level, trustScore, className = '' }) {
  const data = LEVEL_DATA[level] || LEVEL_DATA['New Member']

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-sm transition-all ${className}`}
      style={{ backgroundColor: data.bg, borderColor: data.border, color: data.color }}
      title={`${trustScore} Trust Points`}
    >
      <span>{data.icon}</span>
      <span>{level || 'New Member'}</span>
    </div>
  )
}
