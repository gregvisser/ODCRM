import fs from 'node:fs'

function extractAccountsFromAccountsTab(src) {
  const re = /name:\s*'([^']+)'\s*,\s*website:\s*'([^']+)'/g
  const uniq = new Map()
  for (const m of src.matchAll(re)) {
    if (!uniq.has(m[1])) uniq.set(m[1], { name: m[1], website: m[2] })
  }
  return Array.from(uniq.values())
}

function uniq(arr) {
  return Array.from(new Set(arr))
}

function absolutize(url, baseUrl) {
  if (!url) return null
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) {
    try {
      const b = new URL(baseUrl)
      return `${b.origin}${url}`
    } catch {
      return null
    }
  }
  return null
}

function extractImageUrls(html, baseUrl) {
  const absRe = /https?:\/\/[^\s"'<>]+?\.(?:svg|png|jpe?g|webp)(?:\?[^\s"'<>]*)?/gi
  const abs = html.match(absRe) ?? []

  const protoRelRe = /\/\/[^\s"'<>]+?\.(?:svg|png|jpe?g|webp)(?:\?[^\s"'<>]*)?/gi
  const protoRel = html.match(protoRelRe) ?? []

  const relRe = /(?:src|href)=["'](\/[^"']+?\.(?:svg|png|jpe?g|webp)(?:\?[^"']*)?)["']/gi
  const rel = []
  for (const m of html.matchAll(relRe)) rel.push(m[1])

  const all = uniq([...abs, ...protoRel, ...rel])
    .map((u) => absolutize(u, baseUrl))
    .filter(Boolean)

  return uniq(all)
}

function score(url) {
  const u = url.toLowerCase()
  let s = 0
  if (u.includes('logo')) s += 50
  if (u.includes('brand')) s += 20
  if (u.includes('header')) s += 10
  if (u.includes('navbar')) s += 10
  if (u.includes('custom-logo')) s += 20
  if (u.includes('site-icon')) s += 5
  if (u.endsWith('.svg')) s += 8
  if (u.includes('favicon')) s -= 10
  if (u.includes('apple-touch-icon')) s -= 8
  if (u.includes('cropped-')) s -= 3
  if (u.includes('-32x32') || u.includes('-192x192')) s -= 6
  return s
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  const text = await res.text()
  return { finalUrl: res.url || url, status: res.status, text }
}

const accountsTab = process.argv[2] ?? 'src/components/AccountsTab.tsx'
const outFile = process.argv[3] ?? '.tmp/logo-scan.json'

const src = fs.readFileSync(accountsTab, 'utf8')
const accounts = extractAccountsFromAccountsTab(src)

const results = []
// Keep this polite; scanning all accounts can take a while.
const start = Number(process.argv[4] ?? '0')
const count = Number(process.argv[5] ?? '40')
const toScan = accounts.slice(start, start + count)

for (const a of toScan) {
  try {
    const { finalUrl, status, text } = await fetchHtml(a.website)
    const imgs = extractImageUrls(text, finalUrl)
    const ranked = imgs
      .map((u) => ({ url: u, score: score(u) }))
      .sort((x, y) => y.score - x.score)
    results.push({
      name: a.name,
      website: a.website,
      fetched: { status, finalUrl },
      bestGuess: ranked[0]?.url ?? null,
      topCandidates: ranked.slice(0, 15).map((r) => r.url),
    })
    console.log(`${a.name}: ${ranked[0]?.url ?? 'NO_CANDIDATE'}`)
  } catch (e) {
    results.push({
      name: a.name,
      website: a.website,
      error: String(e?.message ?? e),
      bestGuess: null,
      topCandidates: [],
    })
    console.log(`${a.name}: ERROR`)
  }
}

fs.mkdirSync('.tmp', { recursive: true })
fs.writeFileSync(
  outFile,
  JSON.stringify({ scanned: toScan.length, start, count, results }, null, 2),
  'utf8',
)
console.log(`\nWrote ${outFile}`)


