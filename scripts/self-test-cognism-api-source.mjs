#!/usr/bin/env node
/**
 * Static checks for Cognism lead-source wiring (no live Cognism calls).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

let failed = false
function ok(name) {
  console.log(`PASS ${name}`)
}
function fail(name, detail) {
  console.error(`FAIL ${name}: ${detail}`)
  failed = true
}

try {
  const schema = read('server/prisma/schema.prisma')
  if (!schema.includes('LeadSourceProviderMode')) fail('schema', 'missing LeadSourceProviderMode')
  else ok('schema has LeadSourceProviderMode')

  const route = read('server/src/routes/leadSources.ts')
  if (!route.includes('/cognism/connect')) {
    fail('routes', 'missing cognism connect path')
  } else ok('routes include /cognism/connect')

  const ui = read('src/tabs/marketing/components/LeadSourcesTabNew.tsx')
  if (!ui.includes('connectCognismLeadSource')) fail('ui', 'LeadSourcesTabNew missing connectCognismLeadSource')
  else ok('LeadSourcesTabNew imports Cognism connect')

  const api = read('src/utils/leadSourcesApi.ts')
  if (!api.includes('/api/lead-sources/cognism/connect')) fail('api client', 'missing cognism connect URL')
  else ok('leadSourcesApi has cognism connect helper')

  const norm = read('server/src/services/cognismNormalizer.ts')
  if (!norm.includes('normalizeCognismRedeemedContact')) fail('normalizer', 'missing normalizeCognismRedeemedContact')
  else ok('cognismNormalizer present')

  if (!route.includes('cognismValidateApiKey')) fail('routes', 'missing token validation on connect')
  else if (!route.includes('runCognismApiPoll')) fail('routes', 'missing Cognism poll runner')
  else ok('leadSources Cognism poll + validate')
} catch (e) {
  console.error(e)
  failed = true
}

process.exit(failed ? 1 : 0)
