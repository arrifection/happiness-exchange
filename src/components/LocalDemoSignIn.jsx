import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import CountrySelect from './CountrySelect.jsx'
import { DEFAULT_COUNTRY } from '../lib/locations.js'
import { LOCAL_TEST_USERS, fetchDemoUsers, loginAsDemoUser, loginLocalTestUser } from '../lib/localDevAuth.js'

/**
 * Development-only sign-in shortcuts for the login page.
 *
 * Kept in its own module so the production build drops it entirely: the only
 * callers render it behind a literal `import.meta.env.DEV` check, which makes
 * this module — and the /api/dev/demo helpers it imports — unreachable code.
 *
 * Seeded demo accounts are preferred when the sandbox is running. Otherwise it
 * falls back to the older password-based dummy users from
 * scripts/seed_local_users.py.
 */
export default function LocalDemoSignIn({ apiBase, currentUser, onSuccess }) {
  const navigate = useNavigate()
  const [demoUsers, setDemoUsers] = useState([])
  const [country, setCountry] = useState(DEFAULT_COUNTRY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchDemoUsers(apiBase).then((users) => {
      if (!cancelled) setDemoUsers(users)
    })
    return () => {
      cancelled = true
    }
  }, [apiBase])

  async function signIn(loader) {
    setBusy(true)
    setError('')
    try {
      const data = await loader()
      onSuccess(data)
      navigate('/browse', { replace: true })
    } catch (loginError) {
      setError(
        loginError.message === 'Failed to fetch'
          ? `Cannot reach ${apiBase}. Stay on http://localhost:5173 — not the live website.`
          : loginError.message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-[#8b4cf6]/30 bg-[#efe7ff] p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#5a2fc4]">
        {demoUsers.length ? 'Local demo sandbox' : 'Local dummy login'}
      </p>
      {currentUser ? (
        <p className="mt-1 text-[11px] leading-relaxed text-[#3d246e]">
          Currently signed in as {currentUser.email}. Pick an account below to switch.
        </p>
      ) : demoUsers.length ? (
        <p className="mt-1 text-[11px] leading-relaxed text-[#3d246e]">
          Seeded demo accounts. No email, OTP, or phone verification — one click signs you in as that
          user for every API call.
        </p>
      ) : (
        <p className="mt-1 text-[11px] leading-relaxed text-[#3d246e]">
          This is localhost, not happyexchange.net. Dummy login can override country for testing.
          Regular login uses the country saved on the account.
        </p>
      )}

      <div className="mt-3">
        <CountrySelect
          value={country}
          onChange={setCountry}
          disabled={busy}
          label="Override country (dummy login only)"
        />
      </div>

      <div className="mt-3 grid gap-2">
        {demoUsers.length
          ? demoUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              disabled={busy}
              onClick={() => signIn(() => loginAsDemoUser(apiBase, user, country))}
              className="rounded-xl bg-[#8b4cf6] px-3 py-2 text-left text-[12px] font-bold text-white disabled:opacity-60"
            >
              Continue as {user.name}
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-white/80">
                {user.email} · no password needed
              </span>
            </button>
          ))
          : LOCAL_TEST_USERS.map((user) => (
            <button
              key={user.key}
              type="button"
              disabled={busy}
              onClick={() => signIn(() => loginLocalTestUser(apiBase, user, country))}
              className="rounded-xl bg-[#8b4cf6] px-3 py-2 text-left text-[12px] font-bold text-white disabled:opacity-60"
            >
              Log in as User {user.key}
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-white/80">
                {user.email} · {user.password}
              </span>
            </button>
          ))}
      </div>

      {error ? <p className="mt-2 text-[11px] font-semibold text-[#b3261e]">{error}</p> : null}
    </div>
  )
}
