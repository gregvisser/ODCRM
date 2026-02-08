import { PrismaClient } from '@prisma/client'

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/nextjs-best-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

console.log('[prisma] shared client loaded (lib/prisma.ts)')

prisma.$use(async (params, next) => {
  const isEmailCampaign = params.model === 'EmailCampaign'
  const isWriteAction = params.action === 'create' || params.action === 'createMany' || params.action === 'upsert'

  if (isEmailCampaign && isWriteAction) {
    let hasIdBefore = false
    let removedId = false

    const stripId = (value: unknown) => {
      if (value && typeof value === 'object' && 'id' in value) {
        hasIdBefore = true
        delete (value as { id?: unknown }).id
        removedId = true
      }
    }

    if (params.action === 'create' || params.action === 'createMany') {
      const data = params.args?.data
      if (Array.isArray(data)) {
        data.forEach(stripId)
      } else {
        stripId(data)
      }
    } else if (params.action === 'upsert') {
      stripId(params.args?.create)
      stripId(params.args?.update)
    }

    console.log('[prisma] EmailCampaign write', { action: params.action, hasIdBefore, removedId })
  }

  return next(params)
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
