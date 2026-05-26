export const TRUST_LEVELS = [
  {
    name: 'New Member',
    minPoints: 0,
    icon: '🌱',
    description: 'Welcome to the community — start sharing to earn trust.',
    light: { color: '#3f6212', bg: '#f0fdf4', border: '#bbf7d0' },
    dark: { color: '#86efac', bg: '#14532d33', border: '#166534' },
  },
  {
    name: 'Trusted Giver',
    minPoints: 20,
    icon: '🤝',
    description: 'You have completed donations and earned community trust.',
    light: { color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc' },
    dark: { color: '#7dd3fc', bg: '#0c4a6e33', border: '#0369a1' },
  },
  {
    name: 'Community Helper',
    minPoints: 100,
    icon: '⭐',
    description: 'A reliable member who keeps the exchange moving.',
    light: { color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
    dark: { color: '#c4b5fd', bg: '#4c1d9533', border: '#7c3aed' },
  },
  {
    name: 'Verified Donor',
    minPoints: 250,
    icon: '🏆',
    description: 'Top-tier contributor with a strong track record.',
    light: { color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
    dark: { color: '#fcd34d', bg: '#78350f33', border: '#b45309' },
  },
]

const LEGACY_LEVEL_NAMES = {
  'Trusted Sharer': 'Trusted Giver',
  'Kind Sharer': 'Trusted Giver',
  'Trusted Member': 'Trusted Giver',
  'Kindness Champion': 'Verified Donor',
  'Elite Donor': 'Verified Donor',
  'Community Hero': 'Community Helper',
}

export function normalizeTrustLevel(level) {
  if (!level) return 'New Member'
  return LEGACY_LEVEL_NAMES[level] || level
}

export function getTrustLevelMeta(level) {
  const normalized = normalizeTrustLevel(level)
  return TRUST_LEVELS.find((entry) => entry.name === normalized) || TRUST_LEVELS[0]
}

export function determineTrustLevel(trustScore = 0) {
  let current = TRUST_LEVELS[0]
  for (const level of TRUST_LEVELS) {
    if (trustScore >= level.minPoints) {
      current = level
    }
  }
  return current.name
}

export function getNextLevelPoints(trustScore = 0) {
  for (const level of TRUST_LEVELS) {
    if (trustScore < level.minPoints) {
      return level.minPoints
    }
  }
  return null
}

export function getLevelProgress(trustScore = 0, level) {
  const normalizedLevel = normalizeTrustLevel(level || determineTrustLevel(trustScore))
  const currentIndex = TRUST_LEVELS.findIndex((entry) => entry.name === normalizedLevel)
  const current = TRUST_LEVELS[Math.max(0, currentIndex)]
  const next = TRUST_LEVELS[currentIndex + 1]

  if (!next) {
    return {
      currentLevel: current.name,
      nextLevel: null,
      nextLevelPoints: null,
      progressPct: 100,
      pointsToNext: 0,
    }
  }

  const span = next.minPoints - current.minPoints
  const progressPct = span > 0
    ? Math.min(100, Math.max(0, ((trustScore - current.minPoints) / span) * 100))
    : 0

  return {
    currentLevel: current.name,
    nextLevel: next.name,
    nextLevelPoints: next.minPoints,
    progressPct,
    pointsToNext: Math.max(0, next.minPoints - trustScore),
  }
}

export function getTrustPointsTooltip({ level, trustScore = 0, nextLevelPoints }) {
  const progress = getLevelProgress(trustScore, level)
  const meta = getTrustLevelMeta(progress.currentLevel)

  if (!progress.nextLevelPoints) {
    return `${trustScore} trust points · ${meta.description} You have reached the highest level.`
  }

  return `${trustScore} trust points · ${meta.description} ${progress.pointsToNext} points to ${progress.nextLevel}.`
}
