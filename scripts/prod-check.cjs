/**
 * Production deploy verification.
 * Mode A (backend deploy): EXPECT_BACKEND_SHA set -> assert backend /api/_build sha === EXPECT_BACKEND_SHA (with retries).
 * Mode B (parity/drift): compare frontend __build.json sha to backend /api/_build sha.
 *   - With EXPECT_SHA set: strict gate (frontend and backend must equal EXPECT_SHA).
 *   - Supports bounded retries + mismatch classification.
 *   - Optional bounded auto-recovery: dispatch backend deploy workflow once when FE is updated but BE stays stale.
 *   - Recovery dispatch is suppressed when a backend deploy is already queued/in-progress.
 *
 * Existing contract preserved:
 *   npx --yes cross-env EXPECT_SHA=<sha> node scripts/prod-check.cjs
 */

const https = require('https')
const { execSync } = require('child_process')

const RETRY_COUNT = 60
const RETRY_DELAY_MS = 10000

function toInt(raw, fallback, min = 1) {
  const n = Number.parseInt(String(raw ?? ''), 10)
  if (Number.isNaN(n) || n < min) return fallback
  return n
}

const IN_CI = !!process.env.CI || !!process.env.GITHUB_ACTIONS
const PARITY_MAX_ATTEMPTS = toInt(process.env.PARITY_MAX_ATTEMPTS, IN_CI ? 60 : 1)
const PARITY_RETRY_DELAY_MS = toInt(process.env.PARITY_RETRY_DELAY_MS, 10000)
const AUTO_RECOVER_BACKEND = process.env.AUTO_RECOVER_BACKEND === 'true'
const AUTO_RECOVER_THRESHOLD_ATTEMPT = toInt(
  process.env.AUTO_RECOVER_THRESHOLD_ATTEMPT,
  Math.max(1, Math.min(18, PARITY_MAX_ATTEMPTS))
)
const AUTO_RECOVER_MIN_STALE_MS = toInt(process.env.AUTO_RECOVER_MIN_STALE_MS, 240000)
const RECOVERY_WORKFLOW = (process.env.RECOVERY_WORKFLOW || 'deploy-backend-azure.yml').trim()
const RECOVERY_REF = (process.env.RECOVERY_REF || process.env.GITHUB_REF_NAME || 'main').trim()

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getCurrentGitSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return process.env.GITHUB_SHA || 'unknown'
  }
}

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        resolve({ status: res.statusCode || 0, data })
      })
    })
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

function parseSha(jsonText) {
  try {
    const parsed = JSON.parse(jsonText)
    return parsed.sha || parsed.GIT_SHA || null
  } catch {
    return null
  }
}

function classifyMismatch(frontendSha, backendSha, expectedSha) {
  if (!frontendSha || !backendSha) return 'ENDPOINT_ERROR'
  if (!expectedSha) return frontendSha === backendSha ? 'PARITY_OK' : 'FE_BE_MISMATCH'
  if (frontendSha === expectedSha && backendSha === expectedSha) return 'PARITY_OK'
  if (frontendSha === expectedSha && backendSha !== expectedSha) return 'FE_UPDATED_BE_STALE'
  if (frontendSha !== expectedSha && backendSha === expectedSha) return 'BE_UPDATED_FE_STALE'
  if (frontendSha === backendSha) return 'BOTH_STALE_SAME_SHA'
  return 'BOTH_STALE_DIFFERENT_SHA'
}

function prettyStateLabel(state) {
  switch (state) {
    case 'PARITY_OK':
      return 'parity achieved'
    case 'FE_UPDATED_BE_STALE':
      return 'frontend updated, backend stale'
    case 'BE_UPDATED_FE_STALE':
      return 'backend updated, frontend stale'
    case 'BOTH_STALE_SAME_SHA':
      return 'both stale on same old SHA'
    case 'BOTH_STALE_DIFFERENT_SHA':
      return 'both stale on different SHAs'
    case 'FE_BE_MISMATCH':
      return 'frontend/backend mismatch'
    case 'ENDPOINT_ERROR':
      return 'endpoint error / invalid JSON'
    default:
      return state
  }
}

async function triggerBackendRecovery({ workflowFile, ref }) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  const repo = process.env.GITHUB_REPOSITORY

  if (!token) {
    return { ok: false, reason: 'missing_github_token' }
  }
  if (!repo || !repo.includes('/')) {
    return { ok: false, reason: 'missing_github_repository' }
  }

  const [owner, repoName] = repo.split('/')
  const url = `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`
  const body = JSON.stringify({ ref })

  const response = await fetchUrl(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'odcrm-prod-check',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body,
  })

  if (response.status === 204) {
    return { ok: true, reason: 'dispatch_triggered' }
  }

  return {
    ok: false,
    reason: `dispatch_failed_http_${response.status}`,
    details: response.data ? String(response.data).slice(0, 300) : null,
  }
}

async function findActiveBackendDeploy({ workflowFile, ref, expectedSha }) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  const repo = process.env.GITHUB_REPOSITORY

  if (!token || !repo || !repo.includes('/')) {
    return { known: false, active: false, reason: 'missing_github_context' }
  }

  const [owner, repoName] = repo.split('/')
  const url = `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?status=in_progress&per_page=20&branch=${encodeURIComponent(ref)}`
  const queuedUrl = `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?status=queued&per_page=20&branch=${encodeURIComponent(ref)}`

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'odcrm-prod-check',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const [inProgressRes, queuedRes] = await Promise.all([
    fetchUrl(url, { method: 'GET', headers }),
    fetchUrl(queuedUrl, { method: 'GET', headers }),
  ])

  if (inProgressRes.status < 200 || inProgressRes.status >= 300 || queuedRes.status < 200 || queuedRes.status >= 300) {
    return { known: false, active: false, reason: `workflow_run_query_failed_${inProgressRes.status}_${queuedRes.status}` }
  }

  let inProgressRuns = []
  let queuedRuns = []
  try {
    const parsedInProgress = JSON.parse(inProgressRes.data || '{}')
    const parsedQueued = JSON.parse(queuedRes.data || '{}')
    inProgressRuns = Array.isArray(parsedInProgress.workflow_runs) ? parsedInProgress.workflow_runs : []
    queuedRuns = Array.isArray(parsedQueued.workflow_runs) ? parsedQueued.workflow_runs : []
  } catch {
    return { known: false, active: false, reason: 'workflow_run_query_parse_failed' }
  }

  const runs = [...inProgressRuns, ...queuedRuns]
  if (runs.length === 0) {
    return { known: true, active: false, reason: 'no_active_runs' }
  }

  const hasExpectedShaRun = expectedSha
    ? runs.some((run) => String(run.head_sha || '').trim() === expectedSha)
    : false

  return {
    known: true,
    active: true,
    reason: hasExpectedShaRun ? 'active_run_for_expected_sha' : 'active_run_for_branch',
    runCount: runs.length,
  }
}

async function readBuildShas(frontendBase, backendBase) {
  const frontendUrl = `${frontendBase}/__build.json`
  const backendUrl = `${backendBase}/api/_build`

  const [frontendRes, backendRes] = await Promise.all([fetchUrl(frontendUrl), fetchUrl(backendUrl)])

  const frontendSha = frontendRes.status >= 200 && frontendRes.status < 300 ? parseSha(frontendRes.data) : null
  const backendSha = backendRes.status >= 200 && backendRes.status < 300 ? parseSha(backendRes.data) : null

  return {
    frontendUrl,
    backendUrl,
    frontendRes,
    backendRes,
    frontendSha,
    backendSha,
  }
}

async function modeA(expectedSha, backendUrl) {
  const buildUrl = `${backendUrl}/api/_build`
  console.log('Mode A: Backend deploy verification')
  console.log('  EXPECT_BACKEND_SHA:', expectedSha)
  console.log('  Backend URL:      ', buildUrl)
  console.log('  Retries:          ', RETRY_COUNT, 'attempts,', RETRY_DELAY_MS / 1000, 's apart')
  console.log('')

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      const r = await fetchUrl(buildUrl)
      if (r.status < 200 || r.status >= 300) {
        console.log(`  Attempt ${attempt}/${RETRY_COUNT}: HTTP ${r.status} (expected SHA: ${expectedSha})`)
        if (attempt < RETRY_COUNT) await sleep(RETRY_DELAY_MS)
        continue
      }
      const observedSha = parseSha(r.data)
      console.log(`  Attempt ${attempt}/${RETRY_COUNT}: observed SHA = ${observedSha || '(missing)'}, expected SHA = ${expectedSha}`)
      if (observedSha === expectedSha) {
        console.log('')
        console.log('✅ Backend is serving the expected SHA:', expectedSha)
        process.exit(0)
      }
      if (attempt < RETRY_COUNT) await sleep(RETRY_DELAY_MS)
    } catch (e) {
      console.log(`  Attempt ${attempt}/${RETRY_COUNT}: Error -`, e.message || e, `(expected SHA: ${expectedSha})`)
      if (attempt < RETRY_COUNT) await sleep(RETRY_DELAY_MS)
    }
  }

  console.error('')
  console.error('❌ Backend deploy verification FAILED: backend did not serve expected SHA within retry window.')
  console.error('   Expected SHA:', expectedSha)
  console.error('   Run backend workflow again or check Azure App Service logs.')
  process.exit(1)
}

async function modeB() {
  const FRONTEND = (process.env.PROD_FRONTEND || 'https://odcrm.bidlow.co.uk').replace(/\/$/, '')
  const BACKEND = (process.env.PROD_BACKEND || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
  const expectSha = process.env.EXPECT_SHA ? process.env.EXPECT_SHA.trim() : null
  const currentSha = getCurrentGitSha()

  if (!IN_CI) {
    console.log('CURRENT GIT SHA (this repo):', currentSha)
    console.log('')
  }

  if (expectSha) {
    console.log('EXPECT_SHA:', expectSha)
    console.log(`Parity attempts: ${PARITY_MAX_ATTEMPTS}, delay=${PARITY_RETRY_DELAY_MS}ms`)
    console.log(`Auto-recover backend: ${AUTO_RECOVER_BACKEND ? 'enabled' : 'disabled'} (threshold attempt=${AUTO_RECOVER_THRESHOLD_ATTEMPT})`)
    if (AUTO_RECOVER_BACKEND) {
      console.log(`Auto-recover stale window: ${AUTO_RECOVER_MIN_STALE_MS}ms before fallback dispatch`)
    }
    console.log('')
  }

  let recoveryTriggered = false
  let firstFeUpdatedBeStaleAt = null
  let lastState = 'ENDPOINT_ERROR'
  let lastFrontSha = null
  let lastBackSha = null

  for (let attempt = 1; attempt <= PARITY_MAX_ATTEMPTS; attempt++) {
    const snapshot = await readBuildShas(FRONTEND, BACKEND)

    lastFrontSha = snapshot.frontendSha
    lastBackSha = snapshot.backendSha

    console.log(`--- Parity attempt ${attempt}/${PARITY_MAX_ATTEMPTS} ---`)
    console.log('FRONTEND URL:', snapshot.frontendUrl)
    console.log('  HTTP', snapshot.frontendRes.status)
    console.log('  FRONTEND SHA:', snapshot.frontendSha || '(missing)')
    console.log('BACKEND URL:', snapshot.backendUrl)
    console.log('  HTTP', snapshot.backendRes.status)
    console.log('  BACKEND SHA:', snapshot.backendSha || '(missing)')

    const state = classifyMismatch(snapshot.frontendSha, snapshot.backendSha, expectSha)
    lastState = state
    console.log('PARITY_STATE:', state, `(${prettyStateLabel(state)})`)
    if (state === 'BOTH_STALE_SAME_SHA') {
      console.log('PARITY_NOTE: both endpoints are on the same old SHA; rollout likely still in progress.')
    }

    if (state === 'FE_UPDATED_BE_STALE') {
      if (!firstFeUpdatedBeStaleAt) firstFeUpdatedBeStaleAt = Date.now()
      const staleMs = Date.now() - firstFeUpdatedBeStaleAt
      console.log(`PARITY_NOTE: backend stale duration ${staleMs}ms while frontend is on expected SHA.`)
    } else {
      firstFeUpdatedBeStaleAt = null
    }

    if (state === 'PARITY_OK') {
      if (expectSha) {
        console.log(`\n✅ FRONTEND and BACKEND SHAs match expected: ${expectSha}`)
      } else {
        console.log(`\n✅ FRONTEND and BACKEND SHAs match: ${snapshot.frontendSha}`)
      }
      process.exit(0)
    }

    const shouldTriggerRecovery =
      expectSha &&
      AUTO_RECOVER_BACKEND &&
      !recoveryTriggered &&
      attempt >= AUTO_RECOVER_THRESHOLD_ATTEMPT &&
      firstFeUpdatedBeStaleAt &&
      Date.now() - firstFeUpdatedBeStaleAt >= AUTO_RECOVER_MIN_STALE_MS &&
      state === 'FE_UPDATED_BE_STALE'

    if (shouldTriggerRecovery) {
      const activeRunState = await findActiveBackendDeploy({ workflowFile: RECOVERY_WORKFLOW, ref: RECOVERY_REF, expectedSha: expectSha })
      if (activeRunState.known && activeRunState.active) {
        const count = typeof activeRunState.runCount === 'number' ? activeRunState.runCount : 1
        console.log(`AUTO_RECOVERY: skipped dispatch because backend deploy is already active (${activeRunState.reason}, runs=${count}).`)
      } else {
        if (!activeRunState.known) {
          console.log(`AUTO_RECOVERY: active-run precheck unavailable (${activeRunState.reason}); proceeding with bounded dispatch.`)
        }
        console.log('AUTO_RECOVERY: triggering backend deploy workflow dispatch...')
        const recovery = await triggerBackendRecovery({ workflowFile: RECOVERY_WORKFLOW, ref: RECOVERY_REF })
        if (recovery.ok) {
          recoveryTriggered = true
          console.log(`AUTO_RECOVERY: triggered workflow=${RECOVERY_WORKFLOW} ref=${RECOVERY_REF}`)
        } else {
          recoveryTriggered = true
          console.log(`AUTO_RECOVERY: skipped/failed reason=${recovery.reason}`)
          if (recovery.details) console.log(`AUTO_RECOVERY: details=${recovery.details}`)
        }
      }
    }

    if (attempt < PARITY_MAX_ATTEMPTS) {
      await sleep(PARITY_RETRY_DELAY_MS)
    }
  }

  console.error('\n❌ Prod parity gate failed within retry window.')
  if (expectSha) {
    console.error('   Expected SHA:   ', expectSha)
    console.error('   FRONTEND SHA:  ', lastFrontSha || '(missing)')
    console.error('   BACKEND SHA:   ', lastBackSha || '(missing)')
  }
  console.error('   Final state:    ', lastState, `(${prettyStateLabel(lastState)})`)

  if (lastState === 'FE_UPDATED_BE_STALE') {
    console.error('   Action: backend is stale while frontend is updated.')
    if (!AUTO_RECOVER_BACKEND) {
      console.error('   Auto-recovery is disabled. Enable AUTO_RECOVER_BACKEND=true or dispatch backend deploy manually.')
    }
  }

  process.exit(1)
}

;(async () => {
  const expectedBackendSha = process.env.EXPECT_BACKEND_SHA
  if (expectedBackendSha) {
    const backend = (process.env.PROD_BACKEND || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
    await modeA(expectedBackendSha.trim(), backend)
    return
  }
  await modeB()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
