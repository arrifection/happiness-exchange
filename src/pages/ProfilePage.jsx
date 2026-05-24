import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { RatingStars } from '../components/reputation.jsx'
import TrustBadge from '../components/TrustBadge.jsx'
import LevelProgressBar from '../components/LevelProgressBar.jsx'
import { Button, EmptyState, Surface, TextField } from '../components/ui.jsx'

function formatProfileDate(value) {
  if (!value) {
    return 'Not available'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Not available'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(parsedDate)
}

function formatReviewDate(value) {
  if (!value) {
    return 'Recently'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Recently'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(parsedDate)
}

export default function ProfilePage({
  currentUser,
  myReputation,
  loadingReputation,
  reputationError,
  profileReviews,
  loadingProfileReviews,
  profileReviewsError,
  onUpdateProfile,
  profileUpdating,
  profileMessage,
  profileError,
  onLogout,
  onDeleteAccount,
  accountDeleting,
  accountDeleteError,
  myItems,
  myRequests,
}) {
  const [name, setName] = useState(currentUser?.name || '')
  const [nameError, setNameError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setName(currentUser?.name || '')
    setNameError('')
  }, [currentUser?.name])

  const joinedLabel = useMemo(
    () => formatProfileDate(currentUser?.created_at),
    [currentUser?.created_at],
  )
  const normalizedName = name.trim().replace(/\s+/g, ' ')

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  function validateName(value) {
    const trimmed = value.trim().replace(/\s+/g, ' ')
    if (trimmed.length < 2) {
      return 'Username must be at least 2 characters long.'
    }
    return ''
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextError = validateName(name)
    setNameError(nextError)
    if (nextError) {
      return
    }

    await onUpdateProfile(name)
  }

  const usernameLocked = !currentUser.can_change_username
  const helperMessage = usernameLocked
    ? 'Username can only be changed during the first 7 days after signup.'
    : currentUser.username_change_deadline
      ? `You can change your username until ${formatProfileDate(currentUser.username_change_deadline)}.`
      : 'You can update your username for 7 days after signup.'

  const itemsSharedCount = myItems?.length || 0
  const requestedCount = myRequests?.length || 0
  const completedSharedCount = myReputation?.completed_shared_count || 0
  const completedReceivedCount = myReputation?.completed_received_count || 0
  const completedExchangesCount = myReputation?.completed_exchange_count || 0
  const reviewCount = myReputation?.review_count || 0
  const averageRating = myReputation?.average_rating || 0
  const trustScore = myReputation?.trust_score || 0
  const level = myReputation?.level || 'New Member'
  const nextLevelPts = myReputation?.next_level_points

  return (
    <div className="space-y-4 md:mx-auto md:max-w-4xl md:space-y-6">
      <div className="flex flex-col items-center gap-4 rounded-card border border-[#efe8da]/80 bg-gradient-to-br from-[#8b4cf6]/5 to-[#ffcc22]/10 p-5 sm:flex-row sm:items-start">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#efe7ff] shadow-sm">
          <span className="text-2xl font-bold text-[#8b4cf6]">{currentUser.name.charAt(0).toUpperCase()}</span>
          <div className="absolute inset-0 flex cursor-not-allowed items-center justify-center bg-black/20 opacity-0 transition-opacity hover:opacity-100">
            <span className="text-[9px] font-bold text-white">CHANGE</span>
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold tracking-tight text-[#1f1f1f] md:text-2xl">
            {currentUser.name}
          </h1>
          <p className="mt-0.5 text-[11px] text-[#68766d] md:text-xs">{currentUser.email}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <TrustBadge level={level} trustScore={trustScore} />
            {myReputation?.badges?.map(b => (
               <div key={b} className="inline-flex items-center gap-1.5 rounded-full border border-[#efe8da] bg-[#faf7f1] px-2 py-0.5 text-[10px] font-bold text-[#8c755f]">
                 🏅 {b}
               </div>
            ))}
          </div>
          <div className="mt-3 flex justify-center sm:justify-start">
            <RatingStars rating={averageRating} reviewCount={reviewCount} />
          </div>
        </div>

        <div className="flex min-w-[140px] max-w-[200px] shrink-0 flex-col justify-center rounded-xl border border-[#efe8da]/40 bg-white/60 p-3">
          <div className="flex items-end gap-2 justify-between">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#8c755f]/80">Trust Points</p>
            <p className="text-lg font-bold text-[#8b4cf6] md:text-xl">{trustScore}</p>
          </div>
          <LevelProgressBar currentLevel={level} trustScore={trustScore} nextLevelPts={nextLevelPts} className="mt-2" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <Surface className="p-5 md:col-span-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#1f1f1f] md:text-base">Community Reputation</h2>
              <p className="mt-1 text-[10px] leading-relaxed text-[#68766d] md:text-[11px]">
                Simple trust signals based on completed sharing and community reviews.
              </p>
            </div>
            {loadingReputation ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#68766d]">Refreshing reputation...</p> : null}
          </div>

          {reputationError ? <p className="mt-3 text-[10px] font-bold text-[#c65d4a]">{reputationError}</p> : null}

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Current Badge</p>
              <p className="mt-1 text-[11px] font-bold text-[#1f1f1f]">{myReputation?.current_badge || 'New Member'}</p>
            </div>
            <div className="rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Average Rating</p>
              <p className="mt-1 text-xl font-bold text-[#1f1f1f]">{reviewCount > 0 ? averageRating.toFixed(1) : '0.0'}</p>
            </div>
            <div className="rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Reviews</p>
              <p className="mt-1 text-xl font-bold text-[#1f1f1f]">{reviewCount}</p>
            </div>
            <div className="rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Completed Shared</p>
              <p className="mt-1 text-xl font-bold text-[#1f1f1f]">{completedSharedCount}</p>
            </div>
            <div className="rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Completed Received</p>
              <p className="mt-1 text-xl font-bold text-[#1f1f1f]">{completedReceivedCount}</p>
            </div>
            <div className="rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Total Exchanges</p>
              <p className="mt-1 text-xl font-bold text-[#1f1f1f]">{completedExchangesCount}</p>
            </div>
            <div className="rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Items Listed</p>
              <p className="mt-1 text-xl font-bold text-[#1f1f1f]">{itemsSharedCount}</p>
            </div>
            <div className="rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Requests Made</p>
              <p className="mt-1 text-xl font-bold text-[#1f1f1f]">{requestedCount}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-dashed border-[#efe8da] bg-[#fffdfb] p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Account Type</p>
              <p className="mt-1 text-[11px] font-bold uppercase text-[#1f1f1f]">{currentUser.account_type}</p>
            </div>
            <div className="rounded-xl border border-dashed border-[#efe8da] bg-[#fffdfb] p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Joined</p>
              <p className="mt-1 text-[11px] font-bold text-[#1f1f1f]">{joinedLabel}</p>
            </div>
          </div>
        </Surface>

        <Surface className="p-5">
          <div>
            <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#1f1f1f] md:text-base">Personal Information</h2>
            <p className="mt-1 text-[10px] leading-relaxed text-[#68766d] md:text-[11px]">
              Manage your identity and contact details.
            </p>
          </div>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <TextField
              id="profile-name"
              name="name"
              label="Username"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                if (nameError) {
                  setNameError(validateName(event.target.value))
                }
              }}
              placeholder="Your username"
              disabled={usernameLocked}
            />

            <div className="grid gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Email Address</span>
              <div className="min-h-10 cursor-not-allowed rounded-input border border-[#efe8da] bg-[#faf7f1]/40 px-3 py-2.5 text-[13px] text-[#68766d]">
                {currentUser.email}
              </div>
            </div>

            <div className="grid gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Phone Number</span>
              <div className="relative">
                <input
                  disabled
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  className="min-h-10 w-full cursor-not-allowed rounded-input border border-[#efe8da] bg-[#faf7f1]/40 px-3 text-[13px] text-[#68766d]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase text-[#8c755f]/40">Coming Soon</span>
              </div>
            </div>

            <div className="grid gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Name Change Rule</span>
              <div className="min-h-10 rounded-input bg-[#8b4cf6]/5 px-3 py-2.5 text-[11px] font-medium text-[#8b4cf6]/90">
                {helperMessage}
              </div>
            </div>

            {nameError ? <p className="text-[10px] font-bold text-[#c65d4a]">{nameError}</p> : null}
            {profileMessage ? <p className="text-[10px] font-bold text-[#8b4cf6]">{profileMessage}</p> : null}
            {profileError ? <p className="text-[10px] font-bold text-[#c65d4a]">{profileError}</p> : null}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="submit"
                className="h-10 min-h-0 w-full text-[12px]"
                disabled={usernameLocked || profileUpdating || normalizedName === currentUser.name}
              >
                {profileUpdating ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </div>
          </form>
        </Surface>

        <div className="space-y-4 md:space-y-6">
          <Surface className="p-5">
            <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#1f1f1f] md:text-base">App Preferences</h2>
            <div className="mt-4 flex items-center justify-between py-2">
              <div>
                <p className="text-xs font-bold text-[#1f1f1f]">Dark Theme</p>
                <p className="mt-0.5 text-[10px] text-[#68766d]">Switch to a darker interface.</p>
              </div>
              <div className="relative inline-flex h-5 w-9 cursor-not-allowed items-center rounded-full bg-[#efe8da] opacity-50">
                <span className="inline-block h-3 w-3 translate-x-1 rounded-full bg-white transition" />
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-[#efe8da]/40 py-2">
              <div>
                <p className="text-xs font-bold text-[#1f1f1f]">Email Notifications</p>
                <p className="mt-0.5 text-[10px] text-[#68766d]">Get alerted on new requests.</p>
              </div>
              <div className="relative inline-flex h-5 w-9 cursor-not-allowed items-center rounded-full bg-[#8b4cf6] opacity-50">
                <span className="inline-block h-3 w-3 translate-x-5 rounded-full bg-white transition" />
              </div>
            </div>
          </Surface>

          <Surface className="border-[#c65d4a]/20 p-5">
            <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#c65d4a] md:text-base">Account Security</h2>
            <p className="mt-1 text-[10px] leading-relaxed text-[#68766d] md:text-[11px]">
              Manage your session or permanently remove your account.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <Button
                type="button"
                onClick={onLogout}
                variant="secondary"
                className="h-10 min-h-0 w-full border-[#efe8da] bg-white text-[12px] font-bold text-[#1f1f1f] hover:bg-[#faf7f1]"
              >
                Sign Out
              </Button>

              {!confirmDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  disabled={accountDeleting}
                  onClick={() => setConfirmDelete(true)}
                  className="h-10 min-h-0 w-full text-[12px] font-bold"
                >
                  Delete Account
                </Button>
              ) : (
                <div className="rounded-xl border border-[#c65d4a]/30 bg-[#fff3f0] p-3 space-y-3">
                  <p className="text-[11px] leading-relaxed text-[#68766d]">
                    This permanently deletes your account, listings, requests, messages, and reviews.
                    This cannot be undone.
                  </p>
                  {accountDeleteError ? (
                    <p className="text-[10px] font-bold text-[#c65d4a]">{accountDeleteError}</p>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="danger"
                      disabled={accountDeleting}
                      onClick={async () => {
                        const ok = await onDeleteAccount?.()
                        if (ok) setConfirmDelete(false)
                      }}
                      className="h-10 min-h-0 flex-1 text-[12px] font-bold"
                    >
                      {accountDeleting ? 'Deleting...' : 'Yes, delete my account'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={accountDeleting}
                      onClick={() => {
                        setConfirmDelete(false)
                      }}
                      className="h-10 min-h-0 flex-1 text-[12px] font-bold"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Surface>
        </div>

        <Surface className="p-5 md:col-span-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#1f1f1f] md:text-base">Latest Reviews</h2>
              <p className="mt-1 text-[10px] leading-relaxed text-[#68766d] md:text-[11px]">
                Kind words from completed exchanges appear here.
              </p>
            </div>
            {loadingProfileReviews ? <p className="text-[10px] font-bold uppercase tracking-widest text-[#68766d]">Loading reviews...</p> : null}
          </div>

          {profileReviewsError ? <p className="mt-3 text-[10px] font-bold text-[#c65d4a]">{profileReviewsError}</p> : null}

          {!loadingProfileReviews && !profileReviewsError && profileReviews.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title={`No reviews yet \u{1F331}`}
                description="Complete a few exchanges and your community feedback will show here."
              />
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {profileReviews.slice(0, 6).map((review) => (
              <article key={review.id} className="rounded-card border border-[#efe8da] bg-[#fffdfb] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-bold text-[#1f1f1f]">{review.reviewer_name}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">
                      {review.item_title}
                    </p>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">
                    {formatReviewDate(review.created_at)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <RatingStars rating={review.rating} reviewCount={0} showValue={false} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">{review.rating}/5</span>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-[#68766d]">{review.comment}</p>
              </article>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  )
}
