#!/usr/bin/env node
/**
 * Pilot Release smoke test: runs existing self-tests sequentially (prod-safe, no secrets).
 * If any fails, prints which one and exits 1. If all pass, exits 0.
 * Uses scripts/self-test-utils.mjs exitSoon() for clean exit on Windows.
 */
import { spawnSync } from 'node:child_process'
import { exitSoon } from './self-test-utils.mjs'

const TESTS = [
  'test:send-queue-preview-stage3a',
  'test:enrollment-lifecycle-stage1b',
  'test:send-queue-item-actions-stage3h',
  'test:send-queue-item-detail-stage3i',
  'test:send-worker-dryrun-stage2a',
]

function run(name) {
  const r = spawnSync('npm', ['run', name], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  })
  return r.status
}

function main() {
  console.log('self-test-pilot-release-smoke: running', TESTS.length, 'tests sequentially...\n')
  for (const name of TESTS) {
    console.log('---', name, '---')
    const code = run(name)
    if (code !== 0) {
      console.error('\nself-test-pilot-release-smoke: FAIL —', name, 'exited with', code)
      exitSoon(1)
      return
    }
    console.log('')
  }
  console.log('self-test-pilot-release-smoke: PASS (all tests passed)')
  exitSoon(0)
}

main()
