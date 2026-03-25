#!/usr/bin/env node
/**
 * Contract: SMTP identities use the same `sendEmail` implementation as Outlook for outbound
 * campaigns, legacy scheduler, and send-queue worker — no Graph-only fork in those paths.
 * Regression guard only; no network.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const FILES = [
  {
    file: path.join(root, 'server', 'src', 'services', 'outlookEmailService.ts'),
    mustInclude: ["identity.provider === 'smtp'", 'sendOutboundSmtpMail'],
  },
  {
    file: path.join(root, 'server', 'src', 'routes', 'outlook.ts'),
    mustInclude: ['testSmtpConnection({', "code: 'SMTP_VERIFY_FAILED'"],
  },
  {
    file: path.join(root, 'server', 'src', 'workers', 'sendQueueWorker.ts'),
    mustInclude: ["from '../services/outlookEmailService.js'", 'sendEmail('],
    mustNotInclude: ['provider === \'outlook\''],
  },
  {
    file: path.join(root, 'server', 'src', 'workers', 'emailScheduler.ts'),
    mustInclude: ["from '../services/outlookEmailService.js'", 'sendEmail('],
    mustNotInclude: ['provider === \'outlook\''],
  },
  {
    file: path.join(root, 'server', 'src', 'workers', 'campaignSender.ts'),
    mustInclude: ["from '../services/outlookEmailService.js'", 'sendEmailForOutbound'],
    mustNotInclude: ['provider === \'outlook\''],
  },
]

function main() {
  for (const { file, mustInclude, mustNotInclude } of FILES) {
    if (!fs.existsSync(file)) {
      console.error('self-test-smtp-send-path-contract: FAIL — missing file:', file)
      process.exit(1)
    }
    const content = fs.readFileSync(file, 'utf8')
    const missing = mustInclude.filter((m) => !content.includes(m))
    if (missing.length) {
      console.error('self-test-smtp-send-path-contract: FAIL —', file, 'missing:', missing.join(' | '))
      process.exit(1)
    }
    if (mustNotInclude) {
      const bad = mustNotInclude.filter((m) => content.includes(m))
      if (bad.length) {
        console.error(
          'self-test-smtp-send-path-contract: FAIL —',
          file,
          'must not contain Outlook-only provider gate:',
          bad.join(' | ')
        )
        process.exit(1)
      }
    }
  }
  console.log('self-test-smtp-send-path-contract: OK')
  process.exit(0)
}

main()
