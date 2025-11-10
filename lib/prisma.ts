/**
 * Prisma Client Singleton
 * 
 * This ensures a single Prisma client instance is reused across the app,
 * preventing "too many connections" errors and properly handling hot-reloading in dev.
 */

import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma

