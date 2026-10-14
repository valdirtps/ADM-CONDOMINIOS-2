const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vis = await prisma.valoresIndividuais.findMany();
  for (const vi of vis) {
    const f = await prisma.fatura.findFirst({
      where: {
        proprietarioId: vi.proprietarioId,
        mes_ano: vi.mes_ano,
        status: 'PENDENTE'
      }
    });

    if (f) {
      let detalhes = { itens: [] };
      if (f.detalhes) {
        try { detalhes = JSON.parse(f.detalhes); } catch(e){}
      }
      if (!detalhes.itens) detalhes.itens = [];

      const descMatch = `Valor Exclusivo: ${vi.descricao}`;
      const hasIt = detalhes.itens.find(i => i.descricao === descMatch);

      if (!hasIt) {
        console.log(`Fixing Fatura ${f.mes_ano} for Prop ${vi.proprietarioId} - missing ${descMatch} (${vi.valor})`);
        
        detalhes.itens.push({
          descricao: descMatch,
          valor: vi.valor
        });

        const novoTotal = Math.round((f.valor_total + vi.valor) * 100) / 100;

        await prisma.fatura.update({
          where: { id: f.id },
          data: {
            valor_total: novoTotal,
            detalhes: JSON.stringify(detalhes)
          }
        });
        console.log("Updated Fatura ID:", f.id, "to new total", novoTotal);
      }
    }
  }
}

main().catch(console.error).finally(()=>prisma.$disconnect());
