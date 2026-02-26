#!/usr/bin/env node
/**
 * Self-test: Stage 1A enrollments — schema, routes, and mount (no runtime).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const server = path.join(root, 'server')
const schemaPath = path.join(server, 'prisma', 'schema.prisma')
const routesPath = path.join(server, 'src', 'routes', 'enrollments.ts')
const indexPath = path.join(server, 'src', 'index.ts')

const errors = []

if (!fs.existsSync(schemaPath)) {
  errors.push('Prisma schema not found')
} else {
  const schema = fs.readFileSync(schemaPath, 'utf8')
  if (!schema.includes('model Enrollment ') && !schema.includes('model Enrollment\n')) {
    errors.push('Prisma schema must define model Enrollment')
  }
  if (!schema.includes('model EnrollmentRecipient')) {
    errors.push('Prisma schema must define model EnrollmentRecipient')
  }
  if (!schema.includes('EnrollmentStatus')) {
    errors.push('Prisma schema must define EnrollmentStatus enum or usage')
  }
}

if (!fs.existsSync(routesPath)) {
  errors.push('server/src/routes/enrollments.ts not found')
} else {
  const routes = fs.readFileSync(routesPath, 'utf8')
  if (!routes.includes('/enrollments') && !routes.includes('enrollments')) {
    errors.push('enrollments routes file must reference enrollments endpoint')
  }
  if (!routes.includes('listEnrollmentsForSequence') || !routes.includes('createEnrollmentForSequence')) {
    errors.push('enrollments routes must export list and create handlers')
  }
  if (!routes.includes('requireCustomerId')) {
    errors.push('enrollments routes must use requireCustomerId (tenant-safe)')
  }
}

if (!fs.existsSync(indexPath)) {
  errors.push('server/src/index.ts not found')
} else {
  const index = fs.readFileSync(indexPath, 'utf8')
  if (!index.includes('enrollments') || !index.includes('/api/enrollments')) {
    errors.push('index must mount enrollments router at /api/enrollments')
  }
}

if (errors.length) {
  console.error('self-test-enrollments-stage1a: FAIL')
  errors.forEach((e) => console.error('  -', e))
  process.exit(1)
}

console.log('self-test-enrollments-stage1a: OK')
process.exit(0)
