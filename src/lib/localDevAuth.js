/** Local-development helpers. Never used in production builds. */

export const IS_LOCAL_DEV = Boolean(import.meta.env.DEV)

export const LOCAL_TEST_USERS = [
  {
    key: 'A',
    email: 'user-a@example.com',
    password: 'LocalTest123!',
    action: 'Request Give Away items and open fake deliveries',
  },
  {
    key: 'B',
    email: 'user-b@example.com',
    password: 'LocalTest123!',
    action: 'See incoming requests and propose a swap',
  },
]

export async function loginLocalTestUser(apiBase, user, country) {
  const response = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      country: country || undefined,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Login failed.'
    throw new Error(`${detail} Use localhost, not the live site. Seed with: python scripts/seed_local_users.py`)
  }
  return data
}

/**
 * Demo sandbox helpers.
 *
 * These call /api/dev/demo/*, which the backend only mounts when
 * LOCAL_DEMO_MODE is on and the process is not production. A 404 simply means
 * the sandbox is off, so callers hide the dev-only UI instead of erroring.
 */
const DEMO_SEED_HINT = 'Start the sandbox with LOCAL_DEMO_MODE=true and run: python scripts/demo_env.py'

export async function fetchDemoUsers(apiBase) {
  try {
    const response = await fetch(`${apiBase}/api/dev/demo/users`)
    if (!response.ok) return []
    const data = await response.json().catch(() => ({}))
    return Array.isArray(data.users) ? data.users : []
  } catch {
    return []
  }
}

export async function loginAsDemoUser(apiBase, user, country) {
  const response = await fetch(`${apiBase}/api/dev/demo/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: user.id, country: country || undefined }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Demo sign-in failed.'
    throw new Error(`${detail} ${DEMO_SEED_HINT}`)
  }
  return data
}

export async function resetDemoData(apiBase) {
  const response = await fetch(`${apiBase}/api/dev/demo/reset`, { method: 'POST' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Demo reset failed.'
    throw new Error(`${detail} ${DEMO_SEED_HINT}`)
  }
  return data
}
