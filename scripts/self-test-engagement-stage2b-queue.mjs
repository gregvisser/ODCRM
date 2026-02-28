#!/usr/bin/env node
/**
 * Self-test: Stage 2B queue route presence — contract doc exists and enrollments route defines queue endpoints.
 * Regression guard only; no network.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const contractPath = path.join(root, 'docs', 'product', 'ENGAGEMENT_PIPELINE_STAGE2B_LIVE_SENDING.md')
const enrollmentsRoutePath = path.join(root, 'server', 'src', 'routes', 'enrollments.ts')

const REQUIRED_MARKERS = [
  '/api/enrollments/:enrollmentId/queue',
]

function main() {
  if (!fs.existsSync(contractPath)) {
    console.error('self-test-engagement-stage2b-queue: FAIL — Stage 2B contract doc not found:', contractPath)
    process.exit(1)
  }

  if (!fs.existsSync(enrollmentsRoutePath)) {
    console.error('self-test-engagement-stage2b-queue: FAIL — enrollments route file not found:', enrollmentsRoutePath)
    process.exit(1)
  }

  const routeContent = fs.readFileSync(enrollmentsRoutePath, 'utf8')
  const missing = REQUIRED_MARKERS.filter((m) => !routeContent.includes(m))
  if (missing.length) {
    console.error('self-test-engagement-stage2b-queue: FAIL — route file missing markers:', missing.join(', '))
    process.exit(1)
  }

  console.log('self-test-engagement-stage2b-queue: OK')
  process.exit(0)
}

main()
