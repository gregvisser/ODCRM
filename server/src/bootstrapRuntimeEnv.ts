import fs from 'node:fs'
import path from 'node:path'

type RuntimeEnvPayload = Record<string, unknown>

const serverDir = process.cwd()
const candidates = [
  path.join(serverDir, 'runtimeEnv.generated.json'),
  path.join(serverDir, 'dist', 'runtimeEnv.generated.json'),
]

for (const candidate of candidates) {
  try {
    if (!fs.existsSync(candidate)) continue
    const payload = JSON.parse(fs.readFileSync(candidate, 'utf8')) as RuntimeEnvPayload
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value !== 'string' || !value) continue
      if (!process.env[key]) process.env[key] = value
    }
    break
  } catch {
    // Fall back to normal runtime env if the generated file is unavailable.
  }
}
