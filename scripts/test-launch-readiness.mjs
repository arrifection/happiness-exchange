/**
 * Launch-readiness checks for HF cold-start UX, keep-alive docs, and OG meta.
 * Run: node scripts/test-launch-readiness.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

let passed = 0
let failed = 0

function ok(label) {
  passed += 1
  console.log(`  ✓ ${label}`)
}

function fail(label, detail = '') {
  failed += 1
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
}

console.log('\n=== Launch readiness checks ===\n')

console.log('1. HF cold-start wakeup UX')
const wakeupFiles = [
  'src/lib/backendWakeup.js',
  'src/lib/bootstrapFetch.js',
  'src/components/BackendWakeupBanner.jsx',
  'public/initial-shell.css',
]
for (const file of wakeupFiles) {
  if (existsSync(join(root, file))) ok(`${file} present`)
  else fail(`${file} missing`)
}

const banner = readFileSync(join(root, 'src/components/BackendWakeupBanner.jsx'), 'utf8')
const bootstrapMsg = readFileSync(join(root, 'src/lib/bootstrapFetch.js'), 'utf8')
if (
  bootstrapMsg.includes('Server is starting, please wait')
  && banner.includes('SERVER_STARTING_MESSAGE')
) {
  ok('wakeup banner user message')
} else {
  fail('wakeup banner message')
}

const bootstrap = readFileSync(join(root, 'src/lib/bootstrapFetch.js'), 'utf8')
if (bootstrap.includes('fetchWithBootstrapRetry') && bootstrap.includes('trackBootstrapFetch')) {
  ok('bootstrap retry uses wakeup tracking')
} else {
  fail('bootstrap retry wiring')
}

const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
if (app.includes('fetchWithBootstrapRetry') && app.includes('BackendWakeupBanner')) {
  ok('App.jsx integrates retry + banner')
} else {
  fail('App.jsx integration')
}

const indexHtml = readFileSync(join(root, 'index.html'), 'utf8')
if (indexHtml.includes('he-initial-loader') && indexHtml.includes('initial-shell.css')) {
  ok('index.html branded initial shell (no blank page)')
} else {
  fail('index.html initial shell')
}

console.log('\n2. HF keep-alive plan')
const keepaliveDoc = join(root, 'docs/HF_KEEPALIVE_PLAN.md')
if (existsSync(keepaliveDoc)) {
  ok('docs/HF_KEEPALIVE_PLAN.md')
  const doc = readFileSync(keepaliveDoc, 'utf8')
  if (doc.includes('/api/status/') && doc.includes('UptimeRobot')) ok('keep-alive doc covers endpoint + UptimeRobot')
  else fail('keep-alive doc content')
} else {
  fail('docs/HF_KEEPALIVE_PLAN.md missing')
}

if (existsSync(join(root, 'scripts/keep_alive.py'))) ok('scripts/keep_alive.py')
else fail('scripts/keep_alive.py missing')

if (existsSync(join(root, '.github/workflows/keep-backend-warm.yml'))) ok('GitHub Actions warm ping workflow')
else fail('keep-backend-warm workflow missing')

console.log('\n3. OG image audit doc')
if (existsSync(join(root, 'docs/OG_IMAGE_AUDIT.md'))) ok('docs/OG_IMAGE_AUDIT.md')
else fail('docs/OG_IMAGE_AUDIT.md missing')

console.log('\n4. Production build')
const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
})
if (build.status === 0) {
  ok('npm run build')
} else {
  fail('npm run build', build.stderr || build.stdout)
}

const distRoot = join(root, 'dist')
if (existsSync(join(distRoot, 'og-image.png'))) {
  ok('dist/og-image.png copied to build output')
} else {
  fail('dist/og-image.png missing from build')
}

const distAssets = existsSync(join(distRoot, 'assets'))
  ? readdirSync(join(distRoot, 'assets')).filter((f) => f.endsWith('.js'))
  : []
if (distAssets.length > 0) ok(`dist JS bundles: ${distAssets.length}`)
else fail('dist JS bundles')

console.log('\n5. OG meta audit script')
const ogAudit = spawnSync(process.execPath, [join(root, 'scripts/audit-og-meta.mjs')], {
  cwd: root,
  encoding: 'utf8',
})
if (ogAudit.status === 0) ok('audit-og-meta.mjs')
else {
  fail('audit-og-meta.mjs', ogAudit.stderr || ogAudit.stdout)
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
if (failed > 0) process.exit(1)
