/** Community Impact page — kept for future launch with real DB stats; not routed in App yet. */
import { useEffect, useState } from 'react'

import './CommunityImpactPage.css'

const IMPACT_STATS = [
  { key: 'items_shared', label: 'Items Shared', icon: '🎁' },
  { key: 'needs_fulfilled', label: 'Needs Fulfilled', icon: '💛' },
  { key: 'active_givers', label: 'Active Givers', icon: '🤝' },
  { key: 'community_exchanges', label: 'Community Exchanges', icon: '✨' },
]

const KINDNESS_STORIES = [
  {
    emoji: '📚',
    story: 'A student received free textbooks',
    meta: 'Education · Lahore',
  },
  {
    emoji: '🧥',
    story: 'Winter clothes found a new home',
    meta: 'Warmth · Islamabad',
  },
  {
    emoji: '🎒',
    story: 'School supplies were shared with a family',
    meta: 'Back to school · Karachi',
  },
  {
    emoji: '🪑',
    story: 'Furniture was given a second life',
    meta: 'Home essentials · Rawalpindi',
  },
]

function formatCount(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-PK')
}

export default function CommunityImpactPage({ apiBase }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statsUnavailable, setStatsUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchImpact() {
      try {
        const res = await fetch(`${apiBase}/api/community/impact`)
        if (!res.ok) throw new Error('Stats unavailable')
        const data = await res.json()
        if (!cancelled) {
          setStats(data)
          setStatsUnavailable(false)
        }
      } catch {
        if (!cancelled) setStatsUnavailable(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchImpact()
    return () => {
      cancelled = true
    }
  }, [apiBase])

  return (
    <div className="he-impact-page animate-fade-in">
      <header className="he-impact-header">
        <h1>Community Impact</h1>
        <p>See how shared items are helping people in the community.</p>
      </header>

      {statsUnavailable ? (
        <p className="he-impact-error" role="status">
          Live totals are updating — the stories below show the kind of impact we celebrate together.
        </p>
      ) : null}

      <section className="he-impact-stats" aria-label="Community impact statistics">
        {IMPACT_STATS.map((stat) => (
          <article
            key={stat.key}
            className={['he-impact-stat', loading ? 'is-loading' : ''].filter(Boolean).join(' ')}
          >
            <span className="he-impact-stat-icon" aria-hidden="true">
              {stat.icon}
            </span>
            <div className="he-impact-stat-value" aria-live="polite">
              {loading ? '' : formatCount(stats?.[stat.key])}
            </div>
            <p className="he-impact-stat-label">{stat.label}</p>
          </article>
        ))}
      </section>

      <KindnessWall />

      <InspirationalFooter />
    </div>
  )
}

function KindnessWall() {
  return (
    <section className="he-kindness-wall" aria-labelledby="kindness-wall-heading">
      <div>
        <h2 id="kindness-wall-heading" className="he-kindness-wall-heading">
          Kindness Wall
        </h2>
        <p className="he-kindness-wall-sub">
          Real moments of help — shared with care, not competition.
        </p>
      </div>

      <div className="space-y-2.5">
        {KINDNESS_STORIES.map((entry) => (
          <article key={entry.story} className="he-kindness-card">
            <span className="he-kindness-emoji" aria-hidden="true">
              {entry.emoji}
            </span>
            <div>
              <p className="he-kindness-text">{entry.story}</p>
              <p className="he-kindness-meta">{entry.meta}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function InspirationalFooter() {
  return (
    <footer className="he-impact-footer">
      <p>Every item shared creates an opportunity to help someone.</p>
    </footer>
  )
}
