#!/usr/bin/env node
/**
 * Self-test: Stage 2E — ODCRM_FAIL_ON threshold parsing and evaluation.
 * Unit-tests parseFailOnRules and evaluateFailOn with hardcoded totals (no network).
 */
import { parseFailOnRules, evaluateFailOn } from './send-queue-metrics-report.mjs'

function fail(msg) {
  console.error('self-test-send-queue-metrics-stage2e: FAIL')
  console.error('  ', msg)
  process.exit(1)
}

function main() {
  // Token-only => >0 (existing behavior)
  const r1 = parseFailOnRules('failed,stuckLocked')
  if (r1.length !== 2) fail(`parse "failed,stuckLocked" expected 2 rules, got ${r1.length}`)
  if (r1[0].metric !== 'failed' || r1[0].op !== '>' || r1[0].value !== 0) fail('first rule should be failed>0')
  if (r1[1].metric !== 'stucklocked' || r1[1].op !== '>' || r1[1].value !== 0) fail('second rule should be stuckLocked>0')

  // Explicit thresholds
  const r2 = parseFailOnRules('queued>=10,dueNow>5,stuckLocked=0')
  if (r2.length !== 3) fail(`parse "queued>=10,..." expected 3 rules, got ${r2.length}`)
  if (r2[0].metric !== 'queued' || r2[0].op !== '>=' || r2[0].value !== 10) fail('queued>=10')
  if (r2[1].metric !== 'duenow' || r2[1].op !== '>' || r2[1].value !== 5) fail('dueNow>5')
  if (r2[2].metric !== 'stucklocked' || r2[2].op !== '=' || r2[2].value !== 0) fail('stuckLocked=0')

  // evaluateFailOn: totals with failed=1, rule failed>0 => triggers
  const totals1 = { QUEUED: 0, LOCKED: 0, SENT: 0, FAILED: 1, SKIPPED: 0, dueNow: 0, stuckLocked: 0 }
  const triggers1 = evaluateFailOn(totals1, parseFailOnRules('failed'))
  if (triggers1.length !== 1 || triggers1[0] !== 'failed>0') fail(`expected ['failed>0'], got ${JSON.stringify(triggers1)}`)

  // totals with queued=5, rule queued>=10 => no trigger
  const totals2 = { QUEUED: 5, LOCKED: 0, SENT: 0, FAILED: 0, SKIPPED: 0, dueNow: 0, stuckLocked: 0 }
  const triggers2 = evaluateFailOn(totals2, parseFailOnRules('queued>=10'))
  if (triggers2.length !== 0) fail(`expected no trigger for queued=5 vs queued>=10, got ${JSON.stringify(triggers2)}`)

  // totals with queued=10, rule queued>=10 => trigger
  const totals3 = { QUEUED: 10, LOCKED: 0, SENT: 0, FAILED: 0, SKIPPED: 0, dueNow: 0, stuckLocked: 0 }
  const triggers3 = evaluateFailOn(totals3, parseFailOnRules('queued>=10'))
  if (triggers3.length !== 1 || triggers3[0] !== 'queued>=10') fail(`expected ['queued>=10'], got ${JSON.stringify(triggers3)}`)

  // stuckLocked=0 rule: actual 0 => trigger
  const totals4 = { QUEUED: 0, LOCKED: 0, SENT: 0, FAILED: 0, SKIPPED: 0, dueNow: 0, stuckLocked: 0 }
  const triggers4 = evaluateFailOn(totals4, parseFailOnRules('stuckLocked=0'))
  if (triggers4.length !== 1 || triggers4[0] !== 'stucklocked=0') fail(`expected ['stucklocked=0'], got ${JSON.stringify(triggers4)}`)

  // failed>0,stuckLocked>0 (workflow style): both 0 => no trigger
  const totals5 = { QUEUED: 0, LOCKED: 0, SENT: 0, FAILED: 0, SKIPPED: 0, dueNow: 0, stuckLocked: 0 }
  const triggers5 = evaluateFailOn(totals5, parseFailOnRules('failed>0,stuckLocked>0'))
  if (triggers5.length !== 0) fail(`expected no trigger when both 0, got ${JSON.stringify(triggers5)}`)

  console.log('self-test-send-queue-metrics-stage2e: PASS')
  process.exit(0)
}

main()
