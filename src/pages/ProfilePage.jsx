import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { Button, Surface, TextField } from '../components/ui.jsx'

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

export default function ProfilePage({
  currentUser,
  onUpdateProfile,
  profileUpdating,
  profileMessage,
  profileError,
}) {
  const [name, setName] = useState(currentUser?.name || '')
  const [nameError, setNameError] = useState('')

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

  return (
    <div className="space-y-6">
      <Surface className="p-6 sm:p-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1f6f50]">Profile Settings</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold tracking-tight text-[#1f3328] sm:text-3xl">
              Your account
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#68766d]">
              Manage your profile details while keeping your account data private to you.
            </p>
          </div>
          <div className="rounded-2xl bg-[#f4efe7] px-4 py-3 text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Account Type</p>
            <p className="mt-1 text-sm font-bold text-[#1f3328]">{currentUser.account_type}</p>
          </div>
        </div>
      </Surface>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <Surface className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#1f3328]">Identity</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#68766d]">
                Username updates are limited to the first 7 days after signup.
              </p>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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

            <div className="grid gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Email</span>
              <div className="min-h-10 rounded-xl border border-[#eadfce] bg-[#faf7f1] px-3.5 py-2.5 text-sm text-[#68766d]">
                {currentUser.email}
              </div>
            </div>

            <div className="grid gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Status</span>
              <div className="min-h-10 rounded-xl border border-[#eadfce] bg-[#faf7f1] px-3.5 py-2.5 text-sm text-[#68766d]">
                {helperMessage}
              </div>
            </div>

            {nameError ? <p className="text-[11px] font-medium text-[#c65d4a]">{nameError}</p> : null}
            {profileMessage ? <p className="text-[11px] font-medium text-[#1f6f50]">{profileMessage}</p> : null}
            {profileError ? <p className="text-[11px] font-medium text-[#c65d4a]">{profileError}</p> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="submit"
                className="sm:min-w-[160px]"
                disabled={usernameLocked || profileUpdating || normalizedName === currentUser.name}
              >
                {profileUpdating ? 'Saving...' : 'Update Username'}
              </Button>
              <p className="text-[11px] text-[#68766d]">Whitespace is trimmed and duplicate usernames are blocked.</p>
            </div>
          </form>
        </Surface>

        <div className="space-y-6">
          <Surface className="p-6">
            <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#1f3328]">Account details</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-[#faf7f1] p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Username</p>
                <p className="mt-1 text-sm font-bold text-[#1f3328]">{currentUser.name}</p>
              </div>
              <div className="rounded-2xl bg-[#faf7f1] p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Joined</p>
                <p className="mt-1 text-sm font-bold text-[#1f3328]">{joinedLabel}</p>
              </div>
              <div className="rounded-2xl bg-[#faf7f1] p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Verification</p>
                <p className="mt-1 text-sm font-bold text-[#1f3328]">Trust tools coming soon</p>
                <p className="mt-1 text-xs leading-relaxed text-[#68766d]">
                  We&apos;ll use this area for community trust badges and verification history later.
                </p>
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </div>
  )
}
