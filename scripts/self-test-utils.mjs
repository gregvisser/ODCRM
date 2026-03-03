#!/usr/bin/env node
/**
 * Shared helpers for self-test scripts. No deps.
 * Use exitSoon() to avoid Windows Node v24 UV_HANDLE_CLOSING crash when exiting while fetch is closing.
 */

/**
 * Run fn({ signal }) with an AbortController that aborts after ms.
 * @param {number} ms
 * @param {(opts: { signal: AbortSignal }) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTimeout(ms, fn) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), ms)
  try {
    return await fn({ signal: ac.signal })
  } finally {
    clearTimeout(t)
  }
}

/**
 * Schedule process.exit(code) after 250ms so fetch/connection can close on Windows.
 * Sets process.exitCode = code immediately.
 * @param {number} code
 */
export function exitSoon(code) {
  process.exitCode = code
  setTimeout(() => process.exit(code), 250)
}

/**
 * Read response body as text, return preview of at most maxChars. Never throws.
 * @param {Response} res
 * @param {number} [maxChars=200]
 * @returns {Promise<string>}
 */
export async function readBodyPreview(res, maxChars = 200) {
  try {
    const text = await res.text()
    const s = String(text ?? '')
    return s.length <= maxChars ? s : s.slice(0, maxChars) + '...'
  } catch {
    return '(no body)'
  }
}
