const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Fix the faturas for 2026-05
  const mes_ano = '2026-05';
  const faturas = await prisma.fatura.findMany({ where: { mes_ano } });

  for (const fatura of faturas) {
    let detalhes = JSON.parse(fatura.detalhes || '{}');
    if (!detalhes.itens) continue;

    let novoTotal = 0;
    
    // Fix items values
    detalhes.itens = detalhes.itens.map(item => {
      if (item.descricao === 'Taxa de Condomínio') {
        item.valor = 105;
      }
      if (item.descricao === 'Fundo de Reserva') {
        item.valor = 50;
      }
      novoTotal += item.valor;
      return item;
    });

    await prisma.fatura.update({
      where: { id: fatura.id },
      data: {
        valor_total: novoTotal,
        detalhes: JSON.stringify(detalhes)
      }
    });

    console.log(`Updated fatura ${fatura.id} for owner ${fatura.proprietarioId} to ${novoTotal}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
