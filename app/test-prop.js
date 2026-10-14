const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const f = await prisma.fatura.findMany({
    where: { proprietarioId: 'cmnp9sxvt000hs6fcokz97a01' },
    orderBy: { mes_ano: 'asc' }
  });
  console.dir(f, {depth: null});
  
  const v = await prisma.valoresIndividuais.findMany({
    where: { proprietarioId: 'cmnp9sxvt000hs6fcokz97a01' },
    orderBy: { mes_ano: 'asc' }
  });
  console.dir(v, {depth: null});
}
main().catch(console.error).finally(()=>prisma.$disconnect());
