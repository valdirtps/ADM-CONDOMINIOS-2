const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const f = await prisma.fatura.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, mes_ano: true, valor_total: true, data_vencimento: true, data_pagamento: true, valor_pago: true, dias_atraso: true, multa: true, juros: true, status: true, proprietario: { select: { apartamento: true } } },
    take: 5
  });
  console.log("Faturas Recentes:");
  console.dir(f, { depth: null });

  const vi = await prisma.valoresIndividuais.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Valores Exclusivos Recentes:");
  console.dir(vi, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
