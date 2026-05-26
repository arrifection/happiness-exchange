const sites = (process.env.SITES || 'https://www.happyexchange.net,https://happyexchange.net,https://happiness-exchange.vercel.app').split(',')

for (const base of sites) {
  const url = base.trim()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) })
    const html = await res.text()
    const css = html.match(/\/assets\/index-[^"]+\.css/)?.[0]
    console.log('\n' + url, res.status, css || 'missing')
    if (css) {
      const cssRes = await fetch(url + css, { signal: AbortSignal.timeout(25000) })
      const body = await cssRes.text()
      console.log('  new token #111014:', body.includes('#111014'))
      console.log('  old token #171615:', body.includes('#171615'))
    }
  } catch (e) {
    console.log('\n' + url, 'ERR', e.message)
  }
}
