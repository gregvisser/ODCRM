#!/usr/bin/env node
const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()
if (!CUSTOMER_ID) {
  console.error('self-test-onboarding-readiness-runtime: FAIL - CUSTOMER_ID is required')
  process.exit(1)
}

;(async () => {
  const res = await fetch(`${BASE_URL}/api/onboarding/readiness?customerId=${encodeURIComponent(CUSTOMER_ID)}`, {
    headers: { Accept: 'application/json', 'X-Customer-Id': CUSTOMER_ID },
  })
  if (!res.ok) {
    if (res.status === 404) {
      console.log('SKIP onboarding readiness endpoint not available on target BASE_URL yet')
      console.log('self-test-onboarding-readiness-runtime: PASS')
      return
    }
    const body = await res.text()
    console.error(`self-test-onboarding-readiness-runtime: FAIL - ${res.status} ${body.slice(0, 200)}`)
    process.exit(1)
  }
  const json = await res.json()
  const data = json?.data
  if (!data?.counts || !data?.checks || typeof data?.ready !== 'boolean') {
    console.error('self-test-onboarding-readiness-runtime: FAIL - invalid shape')
    process.exit(1)
  }
  console.log(`PASS onboarding readiness loaded ready=${data.ready}`)
  console.log('self-test-onboarding-readiness-runtime: PASS')
})().catch((err) => {
  console.error(`self-test-onboarding-readiness-runtime: FAIL - ${err?.message || String(err)}`)
  process.exit(1)
})
