/**
 * Cognism client: validation uses Search API; HTML / auth errors are mapped safely.
 * Run from repo root: npm run test:cognism-client-validation
 */
import assert from 'node:assert/strict'
import type { CognismSearchResponse } from '../src/services/cognismClient.js'
import {
  cognismResponseLooksLikeHtml,
  cognismValidateApiKey,
  cognismSearchContacts,
} from '../src/services/cognismClient.js'

const originalFetch = globalThis.fetch

function restoreFetch(): void {
  globalThis.fetch = originalFetch
}

async function run(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (e) {
    console.error(`FAIL ${name}`, e)
    throw e
  }
}

await run('cognismResponseLooksLikeHtml detects doctype', async () => {
  assert.equal(cognismResponseLooksLikeHtml('<!DOCTYPE html><html>'), true)
  assert.equal(cognismResponseLooksLikeHtml('{"results":[]}'), false)
})

await run('cognismValidateApiKey uses POST contact/search with indexSize=1', async () => {
  let capturedUrl = ''
  let capturedInit: RequestInit | undefined
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = typeof input === 'string' ? input : input.toString()
    capturedInit = init
    const ok: CognismSearchResponse = { results: [], totalResults: 0 }
    return new Response(JSON.stringify(ok), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    await cognismValidateApiKey('test-api-key-12345678', { foo: 'bar' })
    assert.match(capturedUrl, /\/api\/search\/contact\/search/)
    assert.match(capturedUrl, /[?&]indexSize=1(?:&|$)/)
    assert.match(capturedUrl, /[?&]lastReturnedKey=/)
    assert.equal(capturedInit?.method, 'POST')
    const body = typeof capturedInit?.body === 'string' ? capturedInit.body : ''
    assert.deepEqual(JSON.parse(body || '{}'), { foo: 'bar' })
    const headers = new Headers(capturedInit?.headers as HeadersInit)
    assert.equal(headers.get('Authorization'), 'Bearer test-api-key-12345678')
  } finally {
    restoreFetch()
  }
})

await run('cognismValidateApiKey unauthorized maps to trusted message', async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ message: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch
  try {
    await cognismValidateApiKey('bad-token-xx')
    assert.fail('expected throw')
  } catch (e) {
    const msg = (e as Error).message
    assert.match(msg, /rejected the API key \(unauthorized\)/)
  } finally {
    restoreFetch()
  }
})

await run('401 with HTML body explains wrong endpoint, not generic unauthorized only', async () => {
  globalThis.fetch = (async () =>
    new Response('<!DOCTYPE html><html><body>login</body></html>', {
      status: 401,
      headers: { 'Content-Type': 'text/html' },
    })) as typeof fetch
  try {
    await cognismValidateApiKey('any-token-here')
    assert.fail('expected throw')
  } catch (e) {
    const msg = (e as Error).message
    assert.match(msg, /web page \(HTTP 401\) instead of API JSON/)
  } finally {
    restoreFetch()
  }
})

await run('search success with HTML body throws clear configuration error', async () => {
  globalThis.fetch = (async () =>
    new Response('<!DOCTYPE html><html><body>login</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })) as typeof fetch
  try {
    await cognismSearchContacts('k', {}, { indexSize: 5 })
    assert.fail('expected throw')
  } catch (e) {
    const msg = (e as Error).message
    assert.match(msg, /HTML instead of API JSON/)
    assert.match(msg, /contact search/)
  } finally {
    restoreFetch()
  }
})

console.log('cognism-client-validation.test.ts: PASS')
