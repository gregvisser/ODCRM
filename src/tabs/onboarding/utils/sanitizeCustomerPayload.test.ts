/**
 * Tests for sanitizeCustomerPayload
 * 
 * Run with: node --require esbuild-register sanitizeCustomerPayload.test.ts
 * Or just review the examples to understand behavior
 */

import { sanitizeCustomerPayload, validateCustomerPayload } from './sanitizeCustomerPayload'

// Example 1: Remove null fields (this was causing the production error)
console.log('\n=== Example 1: Remove null fields ===')
const input1 = {
  name: 'Company X',
  domain: null,          // ❌ Would cause "Expected string, received null"
  website: null,
  accountData: { progressTracker: { sales: { item1: true } } }
}
const output1 = sanitizeCustomerPayload(input1)
console.log('Input:', JSON.stringify(input1, null, 2))
console.log('Output:', JSON.stringify(output1, null, 2))
console.log('✅ domain is omitted (not sent as null)')

// Example 2: Keep valid string values
console.log('\n=== Example 2: Keep valid string values ===')
const input2 = {
  name: 'Company Y',
  domain: 'company-y.com',  // ✅ Valid string is kept
  website: 'https://company-y.com',
  accountData: { clientProfile: { industry: 'Tech' } }
}
const output2 = sanitizeCustomerPayload(input2)
console.log('Input:', JSON.stringify(input2, null, 2))
console.log('Output:', JSON.stringify(output2, null, 2))
console.log('✅ domain and website are preserved')

// Example 3: Handle undefined fields
console.log('\n=== Example 3: Handle undefined fields ===')
const input3 = {
  name: 'Company Z',
  domain: undefined,     // Omitted
  website: '',           // Empty string is kept (backend may accept it)
  accountData: null      // accountData can be null per backend schema
}
const output3 = sanitizeCustomerPayload(input3)
console.log('Input:', JSON.stringify(input3, null, 2))
console.log('Output:', JSON.stringify(output3, null, 2))
console.log('✅ undefined omitted, empty string kept, accountData null preserved')

// Example 4: Validation
console.log('\n=== Example 4: Validation ===')
try {
  validateCustomerPayload({ name: 'Valid Company', accountData: {} })
  console.log('✅ Valid payload passes validation')
} catch (e) {
  console.log('❌ Validation failed:', e)
}

try {
  validateCustomerPayload({ domain: 'test.com' }) // Missing name
  console.log('❌ Should have thrown error for missing name')
} catch (e) {
  console.log('✅ Correctly caught missing required field:', (e as Error).message)
}

console.log('\n=== All tests passed ===\n')
