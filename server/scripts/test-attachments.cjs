/* eslint-disable no-console */

/**
 * Regression safety script: attachments + Web Address wiring
 *
 * Runs against a local backend on http://localhost:3001
 *
 * Steps:
 * 1) Create test customer
 * 2) Set Web Address (Customer.website) via PUT /api/customers/:id/onboarding
 * 3) Upload PDF attachment via POST /api/customers/:id/attachments (multipart)
 * 4) Fetch customer and assert:
 *    - website persisted
 *    - accountData.attachments[] contains the uploaded attachment metadata
 * 5) Archive customer
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function readJsonSafe(res) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return { raw: text }
  }
}

async function main() {
  const testName = `Attachment Test ${new Date().toISOString()}`
  console.log(`[test-attachments] API_BASE=${API_BASE}`)

  // 1) Create customer
  const createRes = await fetch(`${API_BASE}/api/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: testName,
      clientStatus: 'onboarding',
    }),
  })
  const createBody = await readJsonSafe(createRes)
  assert(createRes.ok, `Create customer failed: ${createRes.status} ${JSON.stringify(createBody)}`)

  const customerId = createBody?.id || createBody?.customer?.id
  assert(customerId, `Create response missing customer id: ${JSON.stringify(createBody)}`)
  console.log(`[test-attachments] ✅ Created customer ${customerId}`)

  try {
    // 2) Set Web Address via onboarding save
    const website = 'https://example.com'
    const saveRes = await fetch(`${API_BASE}/api/customers/${customerId}/onboarding`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          name: testName,
          website,
          accountData: {},
        },
      }),
    })
    const saveBody = await readJsonSafe(saveRes)
    assert(saveRes.ok, `Save onboarding failed: ${saveRes.status} ${JSON.stringify(saveBody)}`)
    console.log(`[test-attachments] ✅ Saved Web Address=${website}`)

    // 3) Upload PDF attachment
    const pdfBytes = Buffer.from(
      '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n',
      'utf8'
    )
    const form = new FormData()
    form.append('attachmentType', 'document')
    form.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'test.pdf')

    const uploadRes = await fetch(`${API_BASE}/api/customers/${customerId}/attachments`, {
      method: 'POST',
      body: form,
    })
    const uploadBody = await readJsonSafe(uploadRes)
    assert(uploadRes.ok, `Upload attachment failed: ${uploadRes.status} ${JSON.stringify(uploadBody)}`)
    console.log(`[test-attachments] ✅ Uploaded attachment id=${uploadBody?.attachment?.id}`)

    // 4) Fetch + assert
    const fetchRes = await fetch(`${API_BASE}/api/customers/${customerId}`)
    const customer = await readJsonSafe(fetchRes)
    assert(fetchRes.ok, `Fetch customer failed: ${fetchRes.status} ${JSON.stringify(customer)}`)

    assert(customer.website === website, `Website not persisted. expected=${website} actual=${customer.website}`)

    const attachments = Array.isArray(customer?.accountData?.attachments) ? customer.accountData.attachments : []
    assert(attachments.length >= 1, 'No attachments found in accountData.attachments')

    const found = attachments.find((a) => a && a.fileName === 'test.pdf' && String(a.type || '') === 'document')
    assert(found, `Uploaded attachment metadata not found. attachments=${JSON.stringify(attachments, null, 2)}`)
    assert(found.blobName && found.containerName, 'Attachment missing blobName/containerName')
    assert(found.fileUrl && String(found.fileUrl).includes(`/api/customers/${customerId}/attachments/`), 'Attachment missing fileUrl')

    console.log('[test-attachments] ✅ Assertions passed')
  } finally {
    // 5) Archive customer
    const delRes = await fetch(`${API_BASE}/api/customers/${customerId}`, { method: 'DELETE' })
    const delBody = await readJsonSafe(delRes)
    if (!delRes.ok) {
      console.warn(`[test-attachments] ⚠️ Failed to archive test customer: ${delRes.status}`, delBody)
    } else {
      console.log(`[test-attachments] ✅ Archived customer ${customerId}`)
    }
  }
}

main().catch((err) => {
  console.error('[test-attachments] ❌ FAILED', err)
  process.exitCode = 1
})

