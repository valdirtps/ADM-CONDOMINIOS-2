import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { format } from 'date-fns';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { data_pagamento, valor_pago } = await request.json();
    
    if (!data_pagamento || valor_pago === undefined) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const fatura = await prisma.fatura.findUnique({
      where: { id, condominioId: session.user.condominioId },
      include: { proprietario: true },
    });

    if (!fatura) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
    }

    if (fatura.status === 'PAGO') {
      return NextResponse.json({ error: 'Fatura já está paga' }, { status: 400 });
    }

    const parametrosList = await prisma.parametros.findMany({
      where: { 
        condominioId: session.user.condominioId,
        mes_ano: { lte: fatura.mes_ano }
      },
      orderBy: { mes_ano: 'desc' },
      take: 1
    });
    const parametros = parametrosList[0];

    const dataVencimento = new Date(fatura.data_vencimento);
    const dataPagamento = new Date(data_pagamento);
    
    // Calculate delay
    const diffTime = Math.max(0, dataPagamento.getTime() - dataVencimento.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let multa = 0;
    let juros = 0;
    
    if (parametros && diffDays > parametros.dias_isencao_multa) {
      // Multa/Juros calculado proporcionalmente aos dias de atraso baseado no percentual mensal
      multa = fatura.valor_total * (parametros.multa_percentual / 100) / 30 * diffDays;
    }

    const valorDevido = fatura.valor_total + multa + juros;
    const encargosTotais = multa + juros;
    const diferenca = valorDevido - valor_pago;

    // Update Fatura
    await prisma.fatura.update({
      where: { id },
      data: {
        data_pagamento: dataPagamento,
        valor_pago,
        dias_atraso: diffDays,
        multa,
        juros,
        status: 'PAGO',
      },
    });

    // If there is a difference (underpayment), add to the owner's balance via individual values for next month
    if (diferenca > 0.01) {
      // Calculate next month
      const [yearStr, monthStr] = fatura.mes_ano.split('-');
      let year = parseInt(yearStr);
      let month = parseInt(monthStr);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      const nextMesAno = `${year}-${String(month).padStart(2, '0')}`;

      const dataPgtoFormatada = format(new Date(dataPagamento.getTime() + new Date().getTimezoneOffset() * 60000), 'dd/MM/yyyy');

      const valIndv = await prisma.valoresIndividuais.create({
        data: {
          mes_ano: nextMesAno,
          valor: diferenca,
          descricao: `Multa/Juros por Atraso (Pgto em ${dataPgtoFormatada})`,
          proprietarioId: fatura.proprietarioId,
          condominioId: session.user.condominioId,
        },
      });

      // Update the next month's invoice if it's already generated and still pending
      const nextFatura = await prisma.fatura.findFirst({
        where: {
          proprietarioId: fatura.proprietarioId,
          mes_ano: nextMesAno,
          status: 'PENDENTE',
        }
      });

      if (nextFatura) {
        let detalhesObj: any = { itens: [] };
        if (nextFatura.detalhes) {
          try { detalhesObj = JSON.parse(nextFatura.detalhes); } catch(e){}
        }
        if (!detalhesObj.itens) detalhesObj.itens = [];
        
        detalhesObj.itens.push({
          descricao: `Valor Exclusivo: ${valIndv.descricao}`,
          valor: valIndv.valor
        });

        // Round just in case
        const valTotal = Math.round((nextFatura.valor_total + valIndv.valor) * 100) / 100;

        await prisma.fatura.update({
          where: { id: nextFatura.id },
          data: {
            valor_total: valTotal,
            detalhes: JSON.stringify(detalhesObj)
          }
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error paying fatura:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
