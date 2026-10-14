const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.proprietario.findUnique({where: { id: 'cmnp9sxvt000hs6fcokz97a01' }});
  console.log("Proprietario Atrasado:", p.apartamento);
  
  const f = await prisma.fatura.findFirst({
    where: { proprietarioId: 'cmnp9sxvt000hs6fcokz97a01', mes_ano: '2026-05' }
  });
  console.log("Fatura do Mes 5:", f);
}
main().catch(console.error).finally(()=>prisma.$disconnect());
