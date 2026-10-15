import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres.luwzppwogjnktckkkuhl:Val190103Bd2026@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=3";
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = "postgresql://postgres.luwzppwogjnktckkkuhl:Val190103Bd2026@aws-0-us-east-1.pooler.supabase.com:5432/postgres?connect_timeout=3";
}

const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
