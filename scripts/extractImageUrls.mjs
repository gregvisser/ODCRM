import fs from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/extractImageUrls.mjs <path-to-html>')
  process.exit(1)
}

const html = fs.readFileSync(file, 'utf8')

// Absolute URLs
const absRe = /https?:\/\/[^\s"'<>]+?\.(?:svg|png|jpe?g|webp)(?:\?[^\s"'<>]*)?/gi
const abs = html.match(absRe) ?? []

// Common relative asset patterns (WordPress etc.)
const relRe = /(?:src|href)=["'](\/[^"']+?\.(?:svg|png|jpe?g|webp)(?:\?[^"']*)?)["']/gi
const rel = []
for (const m of html.matchAll(relRe)) rel.push(m[1])

const uniq = (arr) => Array.from(new Set(arr))

const interesting = uniq([...abs, ...rel]).filter((u) =>
  /logo|brand|site-icon|custom-logo|header-logo|navbar/i.test(u)
)

console.log('--- interesting (logo-ish) ---')
console.log(interesting.slice(0, 120).join('\n'))
console.log('\n--- all (first 200) ---')
console.log(uniq([...abs, ...rel]).slice(0, 200).join('\n'))


