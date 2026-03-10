import { readFileSync } from 'fs'
import { resolve } from 'path'

function assertIncludes(content: string, needle: string, label: string): void {
  if (!content.includes(needle)) {
    throw new Error(`Missing expected suppression scope contract: ${label}`)
  }
}

function assertMatches(content: string, pattern: RegExp, label: string): void {
  if (!pattern.test(content)) {
    throw new Error(`Missing expected suppression scope contract: ${label}`)
  }
}

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8')
const customersRoute = readFileSync(resolve(process.cwd(), 'src/routes/customers.ts'), 'utf8')
const suppressionRoute = readFileSync(resolve(process.cwd(), 'src/routes/suppression.ts'), 'utf8')
const sequencesRoute = readFileSync(resolve(process.cwd(), 'src/routes/sequences.ts'), 'utf8')
const sendWorkerRoute = readFileSync(resolve(process.cwd(), 'src/routes/sendWorker.ts'), 'utf8')
const trackingRoute = readFileSync(resolve(process.cwd(), 'src/routes/tracking.ts'), 'utf8')
const complianceTab = readFileSync(resolve(process.cwd(), '../src/tabs/marketing/components/ComplianceTab.tsx'), 'utf8')

assertIncludes(schema, '@@unique([customerId, type, value])', 'schema composite unique by customer')
assertIncludes(schema, '@@index([customerId])', 'schema customerId index')

assertIncludes(customersRoute, 'where: { customerId: id, type: \'email\' }', 'customer suppression summary scoped to route customer')
assertIncludes(customersRoute, 'where: { customerId: id, type: \'domain\' }', 'customer suppression domain summary scoped to route customer')
assertIncludes(customersRoute, 'where: { customerId: id, type: \'email\' }', 'customer suppression import delete scoped to route customer')

assertIncludes(suppressionRoute, 'const customerId = getCustomerId(req)', 'suppression routes derive customerId from request')
assertIncludes(suppressionRoute, 'customerId_type_value', 'suppression upserts keyed by customerId')

assertMatches(sequencesRoute, /suppressionEntry\.findMany\(\{\s*where:\s*\{\s*customerId,/m, 'sequence suppression checks scoped by customerId')
assertMatches(sendWorkerRoute, /suppressionEntry\.findMany\(\{\s*where:\s*\{\s*customerId\s*\}/m, 'send worker suppression load scoped by customerId')
assertIncludes(trackingRoute, 'customerId_type_value', 'tracking unsubscribe suppression upserts scoped by customerId')
assertIncludes(complianceTab, 'Heading size="sm">Target Client</Heading>', 'suppression UI shows explicit target client heading')
assertIncludes(complianceTab, 'Select a client before importing, adding, deleting, or reviewing suppression entries.', 'suppression UI blocks actions without explicit client')
assertIncludes(complianceTab, 'setCurrentCustomerId(nextCustomerId)', 'suppression UI drives active customer selection explicitly')
assertIncludes(complianceTab, 'client-specific and does not affect other clients automatically', 'suppression UI copy states client-specific scope')

console.log('SELF_TEST_OK client-scoped suppression')
