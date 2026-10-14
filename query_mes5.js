const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const vm = await prisma.valoresMensais.findFirst({ where: { mes_ano: '2026-05' }});
  const props = await prisma.proprietario.findMany({ where: { condominioId: vm.condominioId } });
  const param = await prisma.parametros.findFirst();
  console.log('Valores Mensais:', vm);
  console.log('Proprietarios qty:', props.length);
  console.log('Parametros:', param);
  const fat = await prisma.fatura.findMany({ where: { mes_ano: '2026-05' }});
  if(fat.length > 0) {
      console.log('Uma fatura:', JSON.parse(fat[0].detalhes).itens);
      console.log('Total fatura:', fat[0].valor_total);
  }
}
main().finally(() => prisma.$disconnect());
