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
  onLogout,
  myItems,
  myRequests,
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

  const itemsSharedCount = myItems?.length || 0;
  const completedExchangesCount = myItems?.filter(item => item.status === 'completed').length || 0;
  
  let memberStatus = 'New Member';
  if (completedExchangesCount >= 5) {
    memberStatus = 'Trusted Member';
  } else if (itemsSharedCount >= 1) {
    memberStatus = 'Active Sharer';
  }

  const bonusPoints = (itemsSharedCount * 10) + (completedExchangesCount * 50);

  return (
    <div className="space-y-4 md:space-y-6 md:max-w-3xl md:mx-auto">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 bg-gradient-to-br from-[#8b4cf6]/5 to-[#ffcc22]/10 p-5 rounded-card border border-[#efe8da]/80">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-[#efe7ff] shadow-sm flex items-center justify-center">
          {/* Profile Picture Placeholder */}
          <span className="text-2xl font-bold text-[#8b4cf6]">{currentUser.name.charAt(0).toUpperCase()}</span>
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-not-allowed">
             <span className="text-white text-[9px] font-bold">CHANGE</span>
          </div>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl md:text-2xl font-bold tracking-tight text-[#1f1f1f]">{currentUser.name}</h1>
          <p className="text-[11px] md:text-xs text-[#68766d] mt-0.5">{currentUser.email}</p>
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 shadow-xs border border-[#efe8da]">
             <span className="h-2 w-2 rounded-full bg-[#8b4cf6]"></span>
             <span className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">{memberStatus}</span>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-center sm:items-end justify-center rounded-xl bg-white/60 p-3 border border-[#efe8da]/40 min-w-[100px]">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#8c755f]/80">Trust Points</p>
          <p className="mt-0.5 text-lg md:text-xl font-bold text-[#8b4cf6]">{bonusPoints}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Trophies & Stats Area */}
        <Surface className="p-5 md:col-span-2">
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm md:text-base font-bold text-[#1f1f1f]">Your Impact</h2>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
             <div className="rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Items Shared</p>
                <p className="mt-1 text-xl font-bold text-[#1f1f1f]">{itemsSharedCount}</p>
             </div>
             <div className="rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Exchanges</p>
                <p className="mt-1 text-xl font-bold text-[#1f1f1f]">{completedExchangesCount}</p>
             </div>
             <div className="rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Account Type</p>
                <p className="mt-1 text-[11px] font-bold text-[#1f1f1f] capitalize uppercase py-1">{currentUser.account_type}</p>
             </div>
             <div className="rounded-xl border border-[#efe8da] bg-[#faf7f1]/50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Joined</p>
                <p className="mt-1 text-[11px] font-bold text-[#1f1f1f] py-1">{joinedLabel}</p>
             </div>
          </div>
        </Surface>

        {/* Identity form */}
        <Surface className="p-5">
          <div>
            <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm md:text-base font-bold text-[#1f1f1f]">Personal Information</h2>
            <p className="text-[10px] md:text-[11px] leading-relaxed text-[#68766d] mt-1">
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
              <div className="min-h-10 rounded-input border border-[#efe8da] bg-[#faf7f1]/40 px-3 py-2.5 text-[13px] text-[#68766d] cursor-not-allowed">
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
                   className="min-h-10 w-full rounded-input border border-[#efe8da] bg-[#faf7f1]/40 px-3 text-[13px] text-[#68766d] cursor-not-allowed"
                 />
                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase text-[#8c755f]/40">Coming Soon</span>
              </div>
            </div>

            <div className="grid gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]/70">Name Change Rule</span>
              <div className="min-h-10 rounded-input border border-transparent bg-[#8b4cf6]/5 px-3 py-2.5 text-[11px] text-[#8b4cf6]/90 font-medium">
                {helperMessage}
              </div>
            </div>

            {nameError ? <p className="text-[10px] font-bold text-[#c65d4a]">{nameError}</p> : null}
            {profileMessage ? <p className="text-[10px] font-bold text-[#8b4cf6]">{profileMessage}</p> : null}
            {profileError ? <p className="text-[10px] font-bold text-[#c65d4a]">{profileError}</p> : null}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="submit"
                className="w-full h-10 min-h-0 text-[12px]"
                disabled={usernameLocked || profileUpdating || normalizedName === currentUser.name}
              >
                {profileUpdating ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </div>
          </form>
        </Surface>

        {/* Preferences & Danger Zone */}
        <div className="space-y-4 md:space-y-6">
           <Surface className="p-5">
             <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm md:text-base font-bold text-[#1f1f1f]">App Preferences</h2>
             <div className="mt-4 flex items-center justify-between py-2">
                <div>
                   <p className="text-xs font-bold text-[#1f1f1f]">Dark Theme</p>
                   <p className="text-[10px] text-[#68766d] mt-0.5">Switch to a darker interface.</p>
                </div>
                <div className="relative inline-flex h-5 w-9 items-center rounded-full bg-[#efe8da] opacity-50 cursor-not-allowed">
                   <span className="inline-block h-3 w-3 translate-x-1 rounded-full bg-white transition" />
                </div>
             </div>
             <div className="flex items-center justify-between py-2 border-t border-[#efe8da]/40 mt-1">
                <div>
                   <p className="text-xs font-bold text-[#1f1f1f]">Email Notifications</p>
                   <p className="text-[10px] text-[#68766d] mt-0.5">Get alerted on new requests.</p>
                </div>
                <div className="relative inline-flex h-5 w-9 items-center rounded-full bg-[#8b4cf6] opacity-50 cursor-not-allowed">
                   <span className="inline-block h-3 w-3 translate-x-5 rounded-full bg-white transition" />
                </div>
             </div>
           </Surface>

           <Surface className="p-5 border-[#c65d4a]/20">
             <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm md:text-base font-bold text-[#c65d4a]">Account Security</h2>
             <p className="text-[10px] md:text-[11px] leading-relaxed text-[#68766d] mt-1">
                Manage your session or permanently remove your account.
             </p>
             <div className="mt-4 flex flex-col gap-3">
               <Button
                 type="button"
                 onClick={onLogout}
                 variant="secondary"
                 className="w-full h-10 min-h-0 text-[12px] font-bold text-[#1f1f1f] bg-white border-[#efe8da] hover:bg-[#faf7f1]"
               >
                 Sign Out
               </Button>
               <Button
                 type="button"
                 variant="secondary"
                 disabled
                 className="w-full h-10 min-h-0 text-[12px] font-bold text-[#c65d4a] bg-[#fff3f0]/50 border-[#c65d4a]/20 opacity-60 cursor-not-allowed"
               >
                 Delete Account
               </Button>
             </div>
           </Surface>
        </div>
      </div>
    </div>
  )
}
