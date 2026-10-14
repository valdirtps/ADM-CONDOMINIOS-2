const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activeSindico = await prisma.sindico.findFirst({
    where: { condominioId: 'cmos2ue0m0000lb04w30rj205', ativo: true }
  });
  console.log('Active Sindico:', JSON.stringify(activeSindico, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
