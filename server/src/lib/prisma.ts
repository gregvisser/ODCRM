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

prisma.$use(async (params, next) => {
  if (params.model === 'EmailCampaign' && (params.action === 'create' || params.action === 'createMany')) {
    const data = params.args?.data
    if (Array.isArray(data)) {
      data.forEach((item) => {
        if (item && typeof item === 'object' && 'id' in item) {
          delete item.id
        }
      })
    } else if (data && typeof data === 'object' && 'id' in data) {
      delete data.id
    }
  }

  return next(params)
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
