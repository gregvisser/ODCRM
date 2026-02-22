/**
 * Verify unwrapResponsePayload behavior (mirrors src/utils/api.ts).
 * Backend returns { data: array } or { data: object }. Unwrap returns data when present.
 * Run: node scripts/verify-api-unwrap.cjs
 */
function unwrapResponsePayload(parsed, _endpoint) {
  if (parsed === null || typeof parsed !== 'object') return parsed
  const o = parsed
  if (Object.prototype.hasOwnProperty.call(o, 'data')) return o.data
  return parsed
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg)
}

// 1) { data: X } -> X (list)
const out1 = unwrapResponsePayload({ data: [1, 2, 3] }, '/api/foo')
assert(Array.isArray(out1) && out1.length === 3, 'unwrap { data: array }')

// 2) { data: X } -> X (single object)
const out2 = unwrapResponsePayload({ data: { id: '1', name: 'Acme' } }, '/api/customers/abc-123')
assert(out2 && out2.id === '1' && out2.name === 'Acme', 'unwrap { data: object }')

// 3) { data: [] } -> []
const out3 = unwrapResponsePayload({ data: [] }, '/api/customers')
assert(Array.isArray(out3) && out3.length === 0, 'unwrap { data: [] }')

// 4) raw object (no data key) -> unchanged
const out4 = unwrapResponsePayload({ id: '1', name: 'Acme' }, '/api/customers/abc-123')
assert(out4 && out4.id === '1' && out4.name === 'Acme', 'passthrough object without data')

// 5) raw array -> unchanged
const out5 = unwrapResponsePayload([1, 2], '/api/foo')
assert(Array.isArray(out5) && out5.length === 2, 'passthrough raw array')

console.log('verify-api-unwrap: all 5 assertions passed')
process.exit(0)
