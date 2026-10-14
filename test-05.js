const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const f = await prisma.fatura.findMany({
    where: { mes_ano: '2026-05', proprietarioId: 'cmnp9sxvt000hs6fcokz97a01' },
    orderBy: { createdAt: 'desc' },
  });
  console.dir(f, { depth: null });
}
main().catch(console.error).finally(() => prisma.$disconnect());
