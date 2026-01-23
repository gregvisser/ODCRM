import { readFile } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { randomUUID } from 'crypto'
import { PrismaClient } from '../server/node_modules/@prisma/client/index.js'

const serverEnvPath = resolve(process.cwd(), 'server', '.env')
if (!process.env.DATABASE_URL && existsSync(serverEnvPath)) {
  const raw = readFileSync(serverEnvPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const [key, ...rest] = line.split('=')
    if (!key) continue
    const value = rest.join('=').trim().replace(/^"|"$/g, '')
    if (key && value && !process.env[key]) process.env[key] = value
  }
}

const prisma = new PrismaClient()

const inputPath = resolve(process.argv[2] || './exports/opensdoorsv2-clients.json')

function normalizeStatus(status) {
  if (!status) return undefined
  const v = String(status).toLowerCase()
  if (v === 'active' || v === 'inactive' || v === 'onboarding' || v === 'win_back') return v
  return undefined
}

async function main() {
  const raw = await readFile(inputPath, 'utf8')
  const payload = JSON.parse(raw)
  const clients = Array.isArray(payload.clients) ? payload.clients : []

  if (clients.length === 0) {
    console.log('⚠️ No clients found in payload.')
    return
  }

  let created = 0
  let updated = 0

  for (const client of clients) {
    if (!client?.name) continue

    const existing = await prisma.customer.findFirst({
      where: {
        OR: [
          client.id ? { id: client.id } : undefined,
          { name: client.name },
        ].filter(Boolean),
      },
    })

    const data = {
      name: client.name,
      domain: client.domain || undefined,
      leadsReportingUrl: client.leadsReportingUrl || undefined,
      sector: client.sector || undefined,
      clientStatus: normalizeStatus(client.clientStatus),
      targetJobTitle: client.targetJobTitle || undefined,
      prospectingLocation: client.prospectingLocation || undefined,
      monthlyIntakeGBP: client.monthlyIntakeGBP ? Number(client.monthlyIntakeGBP) : undefined,
      defcon: client.defcon ?? undefined,
      weeklyLeadTarget: client.weeklyLeadTarget ?? undefined,
      weeklyLeadActual: client.weeklyLeadActual ?? undefined,
      monthlyLeadTarget: client.monthlyLeadTarget ?? undefined,
      monthlyLeadActual: client.monthlyLeadActual ?? undefined,
      updatedAt: new Date(),
    }

    if (existing) {
      await prisma.customer.update({ where: { id: existing.id }, data })
      updated += 1
    } else {
      await prisma.customer.create({
        data: {
          id: client.id || `cust_${randomUUID()}`,
          ...data,
          createdAt: new Date(),
        },
      })
      created += 1
    }
  }

  console.log(`✅ Import complete. Created: ${created}, Updated: ${updated}`)
}

main()
  .catch((err) => {
    console.error('❌ Import failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
