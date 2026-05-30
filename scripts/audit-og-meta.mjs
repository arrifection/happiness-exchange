/**
 * Open Graph / Twitter meta audit (no browser required).
 * Run: node scripts/audit-og-meta.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE_URL = 'https://www.happyexchange.net'
const OG_URL = `${SITE_URL}/og-image.png`

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

console.log('\n=== OG / social meta audit ===\n')

console.log('1. Local PNG asset')
const pngPath = join(root, 'public/og-image.png')
if (!existsSync(pngPath)) {
  fail('public/og-image.png missing')
} else {
  ok('public/og-image.png exists')
  try {
    const { spawnSync } = await import('node:child_process')
    const probe = spawnSync('python', [
      '-c',
      "from PIL import Image; im=Image.open(r'" + pngPath.replace(/\\/g, '\\\\') + "'); print(im.size, im.format)",
    ], { encoding: 'utf8' })
    const out = (probe.stdout || '').trim()
    if (out.includes('1200') && out.includes('630') && out.includes('PNG')) {
      ok(`PNG dimensions/format: ${out}`)
    } else {
      fail('PNG dimensions', out || probe.stderr)
    }
  } catch (e) {
    fail('PNG probe', e.message)
  }
}

console.log('\n2. index.html meta tags')
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8')
const required = [
  ['og:title', 'property="og:title"'],
  ['og:description', 'property="og:description"'],
  ['og:image', `property="og:image" content="${OG_URL}"`],
  ['og:image:type PNG', 'property="og:image:type" content="image/png"'],
  ['og:image:width 1200', 'property="og:image:width" content="1200"'],
  ['og:image:height 630', 'property="og:image:height" content="630"'],
  ['twitter:card', 'name="twitter:card" content="summary_large_image"'],
  ['twitter:image', `name="twitter:image" content="${OG_URL}"`],
]
for (const [label, needle] of required) {
  if (indexHtml.includes(needle)) ok(label)
  else fail(label, `missing "${needle}"`)
}

if (indexHtml.includes('og-image.svg')) {
  fail('index.html must not reference og-image.svg')
} else {
  ok('index.html does not reference SVG OG image')
}

console.log('\n3. Static legal pages')
for (const page of ['privacy.html', 'terms.html', 'contact.html']) {
  const html = readFileSync(join(root, page), 'utf8')
  if (html.includes(OG_URL) && html.includes('summary_large_image')) {
    ok(`${page} OG/Twitter tags`)
  } else {
    fail(`${page} OG/Twitter tags`)
  }
}

console.log('\n4. siteMeta.js constants')
const siteMeta = readFileSync(join(root, 'src/lib/siteMeta.js'), 'utf8')
if (siteMeta.includes('og-image.png') && siteMeta.includes('OG_IMAGE_WIDTH = 1200')) {
  ok('siteMeta.js uses PNG + 1200 width')
} else {
  fail('siteMeta.js OG constants')
}

console.log(`\n5. Live URL (${OG_URL})`)
try {
  const res = await fetch(OG_URL, { method: 'HEAD', signal: AbortSignal.timeout(15000) })
  if (res.ok) ok(`HTTP ${res.status}`)
  else fail('live OG image', `HTTP ${res.status}`)
  const type = res.headers.get('content-type') || ''
  if (type.includes('image/png')) ok(`Content-Type: ${type}`)
  else fail('Content-Type', type)
} catch (e) {
  fail('live OG image fetch', e.message)
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
if (failed > 0) process.exit(1)
