#!/usr/bin/env node
/**
 * Self-test: Stage 2A route presence — contract doc exists and server defines dry-run + audit endpoints.
 * Regression guard only; no network.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const contractPath = path.join(root, 'docs', 'product', 'ENGAGEMENT_PIPELINE_STAGE2A_SEND_ENGINE.md')
const enrollmentsRoutePath = path.join(root, 'server', 'src', 'routes', 'enrollments.ts')

const REQUIRED_ROUTE_MARKERS = [
  '/dry-run',
  '/audit',
]

function main() {
  if (!fs.existsSync(contractPath)) {
    console.error('self-test-engagement-stage2a-routes: FAIL — contract doc not found:', contractPath)
    process.exit(1)
  }

  if (!fs.existsSync(enrollmentsRoutePath)) {
    console.error('self-test-engagement-stage2a-routes: FAIL — enrollments route file not found:', enrollmentsRoutePath)
    process.exit(1)
  }

  const routeContent = fs.readFileSync(enrollmentsRoutePath, 'utf8')
  const missing = REQUIRED_ROUTE_MARKERS.filter((m) => !routeContent.includes(m))
  if (missing.length) {
    console.error('self-test-engagement-stage2a-routes: FAIL — route file missing path markers:', missing.join(', '))
    process.exit(1)
  }

  console.log('self-test-engagement-stage2a-routes: OK')
  process.exit(0)
}

main()
