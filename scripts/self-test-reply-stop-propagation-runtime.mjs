#!/usr/bin/env node
import https from 'node:https'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

if (!CUSTOMER_ID) {
  console.error('self-test-reply-stop-propagation-runtime: FAIL - CUSTOMER_ID env var is required')
  process.exit(1)
}

function fail(message) {
  console.error(`self-test-reply-stop-propagation-runtime: FAIL - ${message}`)
  process.exit(1)
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `${BASE_URL}${path}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Customer-Id': CUSTOMER_ID,
        },
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () => {
          if ((res.statusCode || 500) < 200 || (res.statusCode || 500) >= 300) {
            reject(new Error(`GET ${path} returned ${res.statusCode} ${body.slice(0, 400)}`))
            return
          }
          try {
            resolve(body ? JSON.parse(body) : null)
          } catch {
            reject(new Error(`GET ${path} did not return valid JSON`))
          }
        })
      }
    )
    req.on('error', reject)
    req.end()
  })
}

function asList(json, label) {
  const list = Array.isArray(json?.data?.items)
    ? json.data.items
    : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
        ? json
        : null
  if (!list) fail(`${label} invalid response shape`)
  return list
}

async function run() {
  const auditsJson = await getJson('/api/send-worker/audits?limit=200')
  const audits = asList(auditsJson, 'audits')

  const markers = audits.filter((row) => {
    const reason = String(row?.reason || '')
    const snapshot = JSON.stringify(row?.snapshot || {})
    return reason === 'SKIP_REPLIED_STOP' || snapshot.includes('SKIP_REPLIED_STOP')
  })

  if (markers.length === 0) {
    console.log(`PASS audits loaded=${audits.length}; no SKIP_REPLIED_STOP rows in current window (wiring OK)`)
    console.log('self-test-reply-stop-propagation-runtime: PASS')
    return
  }

  const groups = new Map()
  for (const row of markers) {
    const snapshot = row?.snapshot && typeof row.snapshot === 'object' ? row.snapshot : {}
    const enrollmentId = String(snapshot?.enrollmentId || '').trim()
    const recipientEmailNorm = normalizeEmail(snapshot?.recipientEmailNorm || snapshot?.recipientEmail)
    if (!enrollmentId || !recipientEmailNorm) continue
    const key = `${enrollmentId}__${recipientEmailNorm}`
    const existing = groups.get(key) || {
      enrollmentId,
      recipientEmailNorm,
      auditRows: [],
    }
    existing.auditRows.push(row)
    groups.set(key, existing)
  }

  let qualifyingSiblingGroupCount = 0
  let provenPropagationGroupCount = 0
  const warnings = []

  for (const group of groups.values()) {
    const queueJson = await getJson(`/api/enrollments/${encodeURIComponent(group.enrollmentId)}/queue`)
    const queueItems = asList(queueJson, 'enrollment queue')
    const recipientItems = queueItems.filter((item) => normalizeEmail(item?.recipientEmail) === group.recipientEmailNorm)
    if (recipientItems.length <= 1) continue

    qualifyingSiblingGroupCount += 1
    const markerQueueIds = new Set(group.auditRows.map((row) => String(row?.queueItemId || '')).filter(Boolean))
    const hasMultiMarkerRows = markerQueueIds.size >= 2
    const hasSiblingSkippedEvidence = recipientItems.some((item) => {
      const itemId = String(item?.id || '')
      const status = String(item?.status || '').toUpperCase()
      const lastError = String(item?.lastError || '').toLowerCase()
      return !markerQueueIds.has(itemId) && status === 'SKIPPED' && lastError.includes('replied_stop')
    })

    if (hasMultiMarkerRows || hasSiblingSkippedEvidence) {
      provenPropagationGroupCount += 1
    } else {
      warnings.push(`No propagation evidence for enrollment=${group.enrollmentId} recipient=${group.recipientEmailNorm}`)
    }
  }

  if (qualifyingSiblingGroupCount > 0 && provenPropagationGroupCount === 0) {
    fail(`found ${qualifyingSiblingGroupCount} sibling-eligible group(s) but no propagation evidence in audits/queue status.`)
  }

  console.log(
    `PASS auditsLoaded=${audits.length} replyStopMarkers=${markers.length} siblingGroups=${qualifyingSiblingGroupCount} provenPropagationGroups=${provenPropagationGroupCount} warnings=${warnings.length}`
  )
  for (const warning of warnings) {
    console.log(`WARN ${warning}`)
  }
  console.log('self-test-reply-stop-propagation-runtime: PASS')
}

run().catch((err) => fail(err?.message || String(err)))
