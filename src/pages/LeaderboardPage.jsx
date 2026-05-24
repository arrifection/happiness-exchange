import React, { useState, useEffect } from 'react'

export default function LeaderboardPage({ apiBase }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch(`${apiBase}/api/leaderboard`)
        if (!res.ok) throw new Error('Failed to fetch leaderboard')
        const data = await res.json()
        setLeaderboard(data.leaderboard || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchLeaderboard()
  }, [apiBase])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8b4cf6] border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12 animate-fade-in">
      <div className="mb-10 text-center">
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-4xl font-extrabold tracking-tight text-[#1f3328] md:text-5xl">
          Top Donors
        </h1>
        <p className="mt-4 text-lg text-[#68766d]">
          Celebrating the most generous members of our community.
        </p>
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center text-[#68766d]">No data yet. Check back soon!</div>
      ) : (
        <div className="space-y-4">
          {leaderboard.map((user, idx) => (
            <div 
              key={user.id} 
              className="flex items-center justify-between rounded-2xl border border-[#efe8da] bg-white p-4 shadow-sm transition-shadow hover:shadow-md md:p-6"
            >
              <div className="flex items-center gap-4 md:gap-6">
                {/* Rank Badge */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fdfcfa] text-lg font-bold text-[#8c755f] md:h-12 md:w-12 md:text-xl">
                  #{idx + 1}
                </div>
                
                <div className="flex items-center gap-3 md:gap-4">
                  {/* Avatar */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b4cf6] to-[#b8860b] text-lg font-bold text-white shadow-md md:h-14 md:w-14 md:text-xl">
                    {(user.full_name || user.username || user.email || 'A')[0].toUpperCase()}
                  </div>
                  
                  {/* Info */}
                  <div>
                    <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-[#1f3328] md:text-lg">
                      {user.full_name || user.username || 'Anonymous User'}
                    </h2>
                    <p className="text-sm font-medium text-[#8b4cf6]">{user.level || 'New Member'}</p>
                  </div>
                </div>
              </div>
              
              {/* Score */}
              <div className="text-right">
                <div className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-black text-[#1f3328] md:text-3xl">
                  {user.trust_score}
                </div>
                <div className="text-xs font-bold uppercase tracking-widest text-[#8c755f]">
                  Points
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
