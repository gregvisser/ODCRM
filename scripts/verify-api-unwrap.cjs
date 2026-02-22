/**
 * Verify unwrapResponsePayload behavior (mirrors src/utils/api.ts unwrapResponsePayload).
 * Run: node scripts/verify-api-unwrap.cjs
 */
function unwrapResponsePayload(parsed, endpoint) {
  if (parsed === null || typeof parsed !== 'object') return parsed
  const o = parsed
  if (Object.prototype.hasOwnProperty.call(o, 'data')) return o.data
  const path = endpoint.replace(/^\//, '').split('?')[0].toLowerCase()
  if (
    (path === 'api/customers' || path.startsWith('api/customers?')) &&
    Object.prototype.hasOwnProperty.call(o, 'customers')
  ) {
    return o.customers
  }
  return parsed
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg)
}

// 1) { data: X } -> X
const out1 = unwrapResponsePayload({ data: [1, 2, 3] }, '/api/foo')
assert(Array.isArray(out1) && out1.length === 3, 'unwrap { data: array }')

// 2) { customers: X } on /api/customers -> X
const out2 = unwrapResponsePayload({ customers: [{ id: '1' }] }, '/api/customers')
assert(Array.isArray(out2) && out2[0].id === '1', 'unwrap { customers } for /api/customers')

// 3) { customers: X } on /api/customers?includeArchived=true -> X
const out3 = unwrapResponsePayload({ customers: [] }, '/api/customers?includeArchived=true')
assert(Array.isArray(out3) && out3.length === 0, 'unwrap { customers } for /api/customers?')

// 4) /api/customers/:id response (object) -> keep as-is
const out4 = unwrapResponsePayload({ id: '1', name: 'Acme' }, '/api/customers/abc-123')
assert(out4 && out4.id === '1' && out4.name === 'Acme', 'do not unwrap /api/customers/:id')

// 5) raw array -> keep as-is
const out5 = unwrapResponsePayload([1, 2], '/api/customers')
assert(Array.isArray(out5) && out5.length === 2, 'raw array unchanged')

console.log('verify-api-unwrap: all 5 assertions passed')
process.exit(0)
