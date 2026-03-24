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
  if (!schema.includes('LeadSourceImportedContact')) fail('schema', 'missing LeadSourceImportedContact')
  else ok('schema has LeadSourceImportedContact')

  const route = read('server/src/routes/leadSources.ts')
  if (!route.includes('/cognism/connect')) {
    fail('routes', 'missing cognism connect path')
  } else ok('routes include /cognism/connect')
  if (route.includes('/:sourceType/open-sheet')) fail('routes', 'open-sheet route should be removed')
  else ok('routes omit open-sheet')
  if (route.includes('router.post(\'/:sourceType/connect\'')) fail('routes', 'sheet connect route should be removed')
  else ok('routes omit sheet connect')

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
  else if (!route.includes('buildCognismSearchBody')) fail('routes', 'missing buildCognismSearchBody for Cognism')
  else ok('leadSources Cognism poll + validate')

  const cognismClientSrc = read('server/src/services/cognismClient.ts')
  if (cognismClientSrc.includes('contactEntitlementSubscription')) {
    fail('cognismClient', 'validation must use documented Search API, not entitlement HTML route')
  } else ok('cognismClient avoids entitlement validation URL')
  if (!cognismClientSrc.includes('cognismValidateApiKey')) fail('cognismClient', 'missing cognismValidateApiKey')
  else if (!cognismClientSrc.includes('/api/search/contact/search')) fail('cognismClient', 'missing contact search path')
  else ok('cognismClient documents Search API path')
} catch (e) {
  console.error(e)
  failed = true
}

process.exit(failed ? 1 : 0)
