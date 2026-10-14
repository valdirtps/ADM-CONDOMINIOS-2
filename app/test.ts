import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const condominio = await prisma.condominio.findFirst({
    include: {
      despesas: true,
      faturas: true
    }
  });

  console.log("Despesas:");
  condominio?.despesas.forEach(d => {
    console.log(`- ${d.id} | ${d.data_pagamento} | ${d.referente} | ${d.valor}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
