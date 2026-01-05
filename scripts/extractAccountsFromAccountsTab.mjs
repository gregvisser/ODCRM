import fs from 'node:fs'

const file = process.argv[2] ?? 'src/components/AccountsTab.tsx'
const src = fs.readFileSync(file, 'utf8')

// Very lightweight extraction from the static `accounts: Account[] = [...]` literal.
// We look for repeated patterns: name: 'X', website: 'Y'
const re = /name:\s*'([^']+)'\s*,\s*website:\s*'([^']+)'/g

const out = []
for (const m of src.matchAll(re)) {
  out.push({ name: m[1], website: m[2] })
}

// De-dupe by name
const uniq = new Map()
for (const a of out) if (!uniq.has(a.name)) uniq.set(a.name, a)

console.log(JSON.stringify(Array.from(uniq.values()), null, 2))


