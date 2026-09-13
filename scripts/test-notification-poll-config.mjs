/**
 * Lightweight checks for notification poll helpers.
 * Run: node scripts/test-notification-poll-config.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'src/components/NotificationContext.jsx'), 'utf8')

assert.match(source, /UNREAD_POLL_INTERVAL_MS\s*=\s*30000/)
assert.match(source, /visibilitychange/)
assert.match(source, /visibilityState\s*===\s*['"]hidden['"]/)
assert.match(source, /AbortController/)
assert.match(source, /clearInterval/)
assert.doesNotMatch(source, /setInterval\(fetchUnreadCount,\s*15000\)/)
assert.match(source, /\/api\/notifications\/unread-count/)

console.log('notification poll config checks passed')
