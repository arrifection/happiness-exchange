/**
 * Local dark-mode smoke test (no browser UI required).
 * Run: node scripts/test-dark-mode.mjs
 * Optional: DEV_URL=http://localhost:5173 node scripts/test-dark-mode.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DEV_URL = process.env.DEV_URL || 'http://localhost:5173'
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

console.log('\n=== Dark mode local tests ===\n')

// 1. Theme module logic
console.log('1. Theme helpers (theme.js)')
try {
  const themePath = join(root, 'src/lib/theme.js')
  const themeSrc = readFileSync(themePath, 'utf8')
  if (themeSrc.includes('happiness_exchange_theme')) ok('THEME_KEY constant present')
  else fail('THEME_KEY missing')

  if (themeSrc.includes("root.classList.add('dark')")) ok('applyTheme adds dark class')
  else fail('applyTheme dark class missing')

  if (themeSrc.includes("root.classList.remove('dark')")) ok('applyTheme removes dark class')
  else fail('applyTheme remove dark missing')
} catch (e) {
  fail('theme.js read', e.message)
}

// 2. CSS tokens
console.log('\n2. CSS dark tokens (index.css)')
try {
  const css = readFileSync(join(root, 'src/index.css'), 'utf8')
  const checks = [
    ['html.dark {', 'dark root variables'],
    ['--color-he-page: #111014', 'dark page color'],
    ['--color-he-surface: #1b1a20', 'dark surface color'],
    ['html.dark .he-app [class*="bg-white"]', 'legacy white card override'],
    ['.he-field {', 'he-field utility'],
    ['.he-chip {', 'he-chip utility'],
  ]
  for (const [needle, label] of checks) {
    if (css.includes(needle)) ok(label)
    else fail(label, `missing "${needle}"`)
  }
} catch (e) {
  fail('index.css read', e.message)
}

// 3. Marketing homepage dark CSS
console.log('\n3. Marketing homepage dark (HomePage.css)')
try {
  const css = readFileSync(join(root, 'src/pages/HomePage.css'), 'utf8')
  if (css.includes('html.dark .he-home')) ok('he-home dark block')
  else fail('he-home dark block missing')
  if (css.includes('html.dark .he-home .he-hero')) ok('hero dark surface')
  else fail('hero dark surface missing')
} catch (e) {
  fail('HomePage.css read', e.message)
}

// 4. Dev server reachable + HTML boot script
console.log(`\n4. Dev server (${DEV_URL})`)
try {
  const res = await fetch(DEV_URL, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) {
    fail('homepage fetch', `HTTP ${res.status}`)
  } else {
    ok(`homepage HTTP ${res.status}`)
    const html = await res.text()
    if (html.includes('happiness_exchange_theme')) ok('inline theme boot script in HTML')
    else fail('inline theme boot script missing')
    if (html.includes('/src/main.jsx')) ok('Vite main entry loaded')
    else fail('main.jsx entry missing')
  }
} catch (e) {
  fail('dev server unreachable', `${e.message} — run: npm run dev`)
}

// 5. Compiled CSS served by Vite (contains dark rules)
console.log('\n5. Vite-served CSS')
try {
  const pageRes = await fetch(DEV_URL, { signal: AbortSignal.timeout(8000) })
  const html = await pageRes.text()
  const cssMatch = html.match(/href="(\/@fs\/[^"]+\/src\/index\.css[^"]*)"/)
    || html.match(/href="(\/src\/index\.css[^"]*)"/)

  if (!cssMatch) {
    // Vite injects CSS via JS module — fetch main.jsx graph indirectly via index.css path
    const cssRes = await fetch(`${DEV_URL}/src/index.css`, { signal: AbortSignal.timeout(8000) })
    if (cssRes.ok) {
      ok('index.css directly reachable')
      const css = await cssRes.text()
      if (css.includes('html.dark')) ok('served CSS includes html.dark rules')
      else fail('served CSS missing html.dark')
      if (css.includes('.he-field')) ok('served CSS includes .he-field')
      else fail('served CSS missing .he-field')
    } else {
      fail('index.css fetch', `HTTP ${cssRes.status}`)
    }
  }
} catch (e) {
  fail('CSS fetch', e.message)
}

// 6. Production build sanity
console.log('\n6. Production build output')
try {
  const distCssDir = join(root, 'dist/assets')
  const { readdirSync } = await import('node:fs')
  const cssFiles = readdirSync(distCssDir).filter((f) => f.endsWith('.css'))
  if (cssFiles.length === 0) {
    fail('dist CSS', 'run npm run build first')
  } else {
    const built = readFileSync(join(distCssDir, cssFiles[0]), 'utf8')
    ok(`dist CSS file: ${cssFiles[0]}`)
    if (built.includes('html.dark')) ok('built CSS contains dark rules')
    else fail('built CSS missing dark rules')
    if (built.includes('#111014')) ok('built CSS has dark page token')
    else fail('built CSS missing dark page color')
  }
} catch (e) {
  fail('dist check', `${e.message} — run npm run build`)
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
if (failed > 0) process.exit(1)

console.log('Manual check in browser:')
console.log(`  1. Open ${DEV_URL}`)
console.log('  2. Login → Profile → toggle Dark Theme ON')
console.log('  3. Visit Browse + Dashboard — cards/inputs should be dark, purple buttons unchanged')
console.log('')
