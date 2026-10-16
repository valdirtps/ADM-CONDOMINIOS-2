const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fatura04 = await prisma.fatura.findUnique({ where: { id: 'cmoaqfcin000is66yvnshyj92' }});
  
  if (fatura04) {
    const diffDays = fatura04.dias_atraso;
    const oldTotal = fatura04.valor_total; // 290.52
    
    const novaMulta = (oldTotal * 0.03 / 30) * diffDays; // 7.55352
    
    await prisma.fatura.update({
      where: { id: fatura04.id },
      data: {
        multa: novaMulta,
        juros: 0,
      }
    });
    console.log(`Fatura 04 atualizada. Nova multa: ${novaMulta}`);

    // Achar valor individual correspondente (para o mes 2026-05)
    const valIndv = await prisma.valoresIndividuais.findFirst({
      where: {
        proprietarioId: fatura04.proprietarioId,
        mes_ano: '2026-05',
        descricao: { contains: 'Atraso' }
      }
    });

    if (valIndv) {
      await prisma.valoresIndividuais.update({
        where: { id: valIndv.id },
        data: { valor: novaMulta }
      });
      console.log(`Valor individual atualizado para ${novaMulta}`);
    }

    // Achar a fatura do mês 05 e atualizar o item
    const fatura05 = await prisma.fatura.findUnique({ where: { id: 'cmohv5h1m0005s66c1x6zbsog' }});
    if (fatura05) {
      let detalhes = JSON.parse(fatura05.detalhes || '{}');
      let found = false;
      let diff = 0;
      if (detalhes.itens) {
        detalhes.itens = detalhes.itens.map(i => {
           if (i.descricao.includes('Atraso')) {
              diff = novaMulta - i.valor;
              i.valor = novaMulta;
              found = true;
           }
           return i;
        });
      }

      if (found) {
        const novoTotal = fatura05.valor_total + diff;
        await prisma.fatura.update({
           where: { id: fatura05.id },
           data: {
             detalhes: JSON.stringify(detalhes),
             valor_total: novoTotal
           }
        });
        console.log(`Fatura 05 atualizada. Novo total: ${novoTotal}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
