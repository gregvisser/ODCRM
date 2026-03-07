#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function fail(message) {
  console.error(`self-test-deploy-reliability-runtime: FAIL - ${message}`)
  process.exit(1)
}

const root = process.cwd()
const prodCheckPath = join(root, 'scripts', 'prod-check.cjs')
const parityWorkflowPath = join(root, '.github', 'workflows', 'prod-parity-after-merge.yml')
const backendWorkflowPath = join(root, '.github', 'workflows', 'deploy-backend-azure.yml')

const prodCheck = readFileSync(prodCheckPath, 'utf8')
const parityWorkflow = readFileSync(parityWorkflowPath, 'utf8')
const backendWorkflow = readFileSync(backendWorkflowPath, 'utf8')

const requiredProdCheckMarkers = [
  'EXPECT_SHA',
  'PARITY_STATE:',
  'AUTO_RECOVER_BACKEND',
  'AUTO_RECOVERY: triggering backend deploy workflow dispatch...',
  'triggerBackendRecovery',
  'RECOVERY_WORKFLOW',
]

for (const marker of requiredProdCheckMarkers) {
  if (!prodCheck.includes(marker)) {
    fail(`scripts/prod-check.cjs missing marker: ${marker}`)
  }
}

const requiredParityWorkflowMarkers = [
  'AUTO_RECOVER_BACKEND: \'true\'',
  'AUTO_RECOVER_THRESHOLD_ATTEMPT: \'18\'',
  'RECOVERY_WORKFLOW: deploy-backend-azure.yml',
  'PARITY_MAX_ATTEMPTS: \'90\'',
  'GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
  'actions: write',
]

for (const marker of requiredParityWorkflowMarkers) {
  if (!parityWorkflow.includes(marker)) {
    fail(`prod-parity-after-merge workflow missing marker: ${marker}`)
  }
}

if (!backendWorkflow.includes('concurrency:') || !backendWorkflow.includes('group: deploy-backend-main')) {
  fail('deploy-backend workflow missing main concurrency guard')
}

console.log('PASS prod-check includes strict parity classification + bounded auto-recovery path')
console.log('PASS prod parity workflow wires retry window and backend recovery dispatch settings')
console.log('PASS backend deploy workflow includes concurrency guard on main deploys')
console.log('self-test-deploy-reliability-runtime: PASS')
