import fs from 'node:fs'
import path from 'node:path'

type RuntimeEnvPayload = Record<string, unknown>

let cachedRuntimeEnv: RuntimeEnvPayload | null | undefined

function readRuntimeEnv(): RuntimeEnvPayload | null {
  if (cachedRuntimeEnv !== undefined) return cachedRuntimeEnv

  const serverDir = process.cwd()
  const candidates = [
    path.join(serverDir, 'runtimeEnv.generated.json'),
    path.join(serverDir, 'dist', 'runtimeEnv.generated.json'),
    path.join(serverDir, 'buildInfo.generated.json'),
    path.join(serverDir, 'dist', 'buildInfo.generated.json'),
  ]

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue
      cachedRuntimeEnv = JSON.parse(fs.readFileSync(candidate, 'utf8')) as RuntimeEnvPayload
      return cachedRuntimeEnv
    } catch {
      // Fall through to the next candidate.
    }
  }

  cachedRuntimeEnv = null
  return cachedRuntimeEnv
}

function readRuntimeFlag(key: 'ENABLE_SEND_QUEUE_SENDING' | 'ENABLE_LIVE_SENDING'): string | undefined {
  const runtimeEnv = readRuntimeEnv()
  const fallback = runtimeEnv?.[key]
  if (typeof fallback === 'string' && fallback !== '') return fallback
  const envValue = process.env[key]
  return typeof envValue === 'string' && envValue !== '' ? envValue : undefined
}

export function isSendQueueSendingEnabled(): boolean {
  return readRuntimeFlag('ENABLE_SEND_QUEUE_SENDING') === 'true'
}

export function isLiveSendingEnabled(): boolean {
  return readRuntimeFlag('ENABLE_LIVE_SENDING') === 'true'
}
