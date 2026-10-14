import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const fx = await prisma.fatura.findMany();
  console.log(fx.map(f => ({
    mes_ano: f.mes_ano,
    status: f.status,
    data_vencimento: f.data_vencimento,
    data_pagamento: f.data_pagamento,
    valor_pago: f.valor_pago,
    valor_total: f.valor_total
  })));
  await prisma.$disconnect();
}
run();
