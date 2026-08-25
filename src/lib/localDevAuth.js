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
