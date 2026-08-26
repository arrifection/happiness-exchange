import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

import CountrySelect from './CountrySelect.jsx'
import { fetchDemoUsers, loginAsDemoUser, resetDemoData } from '../lib/localDevAuth.js'

/**
 * Development-only toolbar for the local demo sandbox.
 *
 * Rendered by App only when import.meta.env.DEV is true, so it is dropped from
 * production bundles. The switcher swaps the real authenticated identity: it
 * requests a normal access token for a seeded demo account and hands it to the
 * same handleAuthSuccess the login page uses, so every API call afterwards runs
 * as that user.
 */
export default function LocalDemoBar({
  apiBase,
  currentUser,
  country,
  onCountryChange,
  onAuthSuccess,
  onError,
}) {
  const [demoUsers, setDemoUsers] = useState([])
  const [busy, setBusy] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchDemoUsers(apiBase).then((users) => {
      if (!cancelled) setDemoUsers(users)
    })
    return () => {
      cancelled = true
    }
  }, [apiBase])

  async function switchToDemoUser(user) {
    setBusy(user.id)
    setStatus('')
    try {
      const data = await loginAsDemoUser(apiBase, user, country)
      onAuthSuccess(data)
      setStatus(`Signed in as ${data.user?.name || user.name}`)
    } catch (error) {
      onError?.(error.message)
    } finally {
      setBusy('')
    }
  }

  async function handleReset() {
    if (!window.confirm('Reset all demo data back to the seeded starting state?')) return
    setBusy('reset')
    setStatus('')
    try {
      const data = await resetDemoData(apiBase)
      setDemoUsers(await fetchDemoUsers(apiBase))
      setStatus(`Demo data reset (${Object.values(data.inserted || {}).reduce((sum, n) => sum + n, 0)} documents)`)
      // Seeded ids are stable, so the current session survives a reset — just
      // pull the freshly seeded rows back into the app.
      window.setTimeout(() => window.location.reload(), 600)
    } catch (error) {
      onError?.(error.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="border-b border-[#8b4cf6]/40 bg-[#efe7ff] px-4 py-2.5 text-[13px] font-bold text-[#5a2fc4]">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span>LOCAL APP — not the live website. API: {apiBase}</span>
        <NavLink to="/deliveries" className="underline">Delivery</NavLink>
        <NavLink to="/swaps" className="underline">Exchange</NavLink>
      </div>

      {demoUsers.length ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <span className="text-[11px] uppercase tracking-wide">
            Demo user: {currentUser ? currentUser.name : 'signed out'}
          </span>
          {demoUsers.map((user) => {
            const isActive = currentUser?.id === user.id
            return (
              <button
                key={user.id}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => switchToDemoUser(user)}
                className={[
                  'rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wide disabled:opacity-60',
                  isActive ? 'bg-[#3d246e] text-white' : 'bg-[#8b4cf6] text-white',
                ].join(' ')}
              >
                {busy === user.id ? 'Switching…' : `${isActive ? '● ' : ''}${user.name}`}
              </button>
            )
          })}
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={handleReset}
            className="rounded-full border border-[#8b4cf6] px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-[#5a2fc4] disabled:opacity-60"
          >
            {busy === 'reset' ? 'Resetting…' : 'Reset demo data'}
          </button>
          <div className="w-full max-w-xs">
            <CountrySelect value={country} onChange={onCountryChange} disabled={Boolean(busy)} />
          </div>
          {status ? <span className="text-[11px] font-semibold normal-case">{status}</span> : null}
        </div>
      ) : (
        <p className="mt-1 text-center text-[11px] font-semibold normal-case text-[#3d246e]">
          Demo sandbox off. Set LOCAL_DEMO_MODE=true in .env and run: python scripts/demo_env.py
        </p>
      )}
    </div>
  )
}
