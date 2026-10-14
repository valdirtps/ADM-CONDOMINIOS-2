const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const ds = await prisma.despesa.findMany();
  
  const sumByRef = ds.reduce((acc, d) => {
    acc[d.referente] = (acc[d.referente] || 0) + d.valor;
    return acc;
  }, {});
  
  console.log("Sum by referente:", sumByRef);
  
  const sumByDate = ds.reduce((acc, d) => {
    const k = d.data_pagamento.toISOString().split('T')[0];
    acc[k] = (acc[k] || 0) + d.valor;
    return acc;
  }, {});
  console.log("Sum by data_pagamento:", sumByDate);
  
  await prisma.$disconnect();
}
run();
