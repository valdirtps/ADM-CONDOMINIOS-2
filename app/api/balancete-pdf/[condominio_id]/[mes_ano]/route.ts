import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { generateBalancetePDFBuffer } from '@/lib/balancete-pdf';

export async function GET(req: Request, { params }: { params: Promise<{ condominio_id: string; mes_ano: string }> }) {
  try {
    const { condominio_id, mes_ano } = await params;
    const mesAno = mes_ano;

    let condominio: any = null;

    // 1. Try Firebase Firestore
    try {
      const { getDocument, listDocuments } = await import('@/lib/firestore-service');
      const condoDoc = await getDocument<any>('condominios', condominio_id);
      if (condoDoc) {
        const [despesas, creditosExtras, chamadasExtras, faturas, parametros, proprietarios] = await Promise.all([
          listDocuments<any>('despesas'),
          listDocuments<any>('creditosExtras'),
          listDocuments<any>('chamadasExtras'),
          listDocuments<any>('faturas'),
          listDocuments<any>('parametros'),
          listDocuments<any>('proprietarios'),
        ]);

        const propMap = new Map((proprietarios || []).map(p => [p.id, p]));

        condominio = {
          ...condoDoc,
          despesas: (despesas || []).filter(d => !d.condominioId || d.condominioId === condominio_id),
          creditosExtras: (creditosExtras || []).filter(c => !c.condominioId || c.condominioId === condominio_id),
          chamadasExtras: (chamadasExtras || []).filter(ce => !ce.condominioId || ce.condominioId === condominio_id),
          faturas: (faturas || [])
            .filter(f => !f.condominioId || f.condominioId === condominio_id)
            .map(f => ({
              ...f,
              proprietario: f.proprietario || propMap.get(f.proprietarioId) || { apartamento: '-', nome: 'Proprietário' }
            })),
          parametros: (parametros || []).filter(p => !p.condominioId || p.condominioId === condominio_id)
        };
      }
    } catch (fbErr: any) {
      console.warn('Firestore lookup error in balancete-pdf:', fbErr?.message);
    }

    // 2. Fallback to Prisma
    if (!condominio) {
      try {
        condominio = await prisma.condominio.findUnique({
          where: { id: condominio_id },
          include: {
            despesas: true,
            creditosExtras: true,
            chamadasExtras: true,
            faturas: {
              include: { proprietario: true }
            },
            parametros: { orderBy: { mes_ano: 'desc' } }
          }
        });
      } catch (prismaErr: any) {
        console.warn('Prisma lookup error in balancete-pdf:', prismaErr?.message);
      }
    }

    if (!condominio) {
      return new NextResponse('Condomínio não encontrado', { status: 404 });
    }

    const [year, month] = mesAno.split('-');

    const getVencimentoForCycle = (referente: string | null, data_pagamento: any) => {
      let dataCalc = data_pagamento ? new Date(data_pagamento) : new Date();
      if (referente && referente.match(/^\d{4}-\d{2}$/)) {
        const [y, m] = referente.split('-').map(Number);
        dataCalc = new Date(Date.UTC(y, m - 1, 15, 12, 0, 0));
      }
      let nextMonth = dataCalc.getUTCMonth(); 
      let nextYear = dataCalc.getUTCFullYear();
      const mesAnoStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;
      const param = (condominio.parametros || []).find((p: any) => p.mes_ano <= mesAnoStr) || condominio.parametros?.[0];
      const diaVencimento = param ? param.dia_vencimento : 10;
      return new Date(Date.UTC(nextYear, nextMonth, diaVencimento, 12, 0, 0));
    };

    const allTransactions = [
      ...(condominio.despesas || []).map((d: any) => ({
        type: 'despesa',
        data: getVencimentoForCycle(d.referente, d.data_pagamento),
        entrada: 0,
        saida: Number(d.valor) || 0,
        desc: d.tipo,
        raw: d
      })),
      ...(condominio.creditosExtras || []).map((c: any) => ({
        type: 'credito',
        data: c.data_vencimento ? new Date(c.data_vencimento) : getVencimentoForCycle(c.mes_ano || c.referente, c.data_pagamento || c.data_lancamento),
        entrada: Number(c.valor) || 0,
        saida: 0,
        desc: c.referente,
        raw: c
      })),
      ...(condominio.faturas || []).filter((f: any) => f.status === 'PAGO' || f.status === 'PARCIAL').map((f: any) => ({
        type: 'fatura',
        data: f.data_vencimento ? new Date(f.data_vencimento) : new Date(),
        entrada: Number(f.valor_pago || f.valor_total) || 0,
        saida: 0,
        desc: `Apto ${f.proprietario?.apartamento || ''}`,
        raw: f
      })),
    ].sort((a, b) => a.data.getTime() - b.data.getTime());

    let saldoInicial = Number(condominio.saldo_inicial) || 0;
    let saldoAnterior = saldoInicial;
    let totalEntradas = 0;
    let totalSaidas = 0;

    const currentMonthTransactions: any[] = [];
    
    for (const t of allTransactions) {
      const tYear = t.data.getUTCFullYear();
      const tMonth = t.data.getUTCMonth() + 1;
      const tMesAno = `${tYear}-${String(tMonth).padStart(2, '0')}`;
      if (tMesAno < mesAno) {
        saldoAnterior += t.entrada - t.saida;
      } else if (tMesAno === mesAno) {
        currentMonthTransactions.push(t);
        totalEntradas += t.entrada;
        totalSaidas += t.saida;
      }
    }

    const saldoFinal = saldoAnterior + totalEntradas - totalSaidas;
    const despesasDoMes = currentMonthTransactions.filter(t => t.type === 'despesa');
    const faturasPagas = currentMonthTransactions.filter(t => t.type === 'fatura');
    const creditosExtras = currentMonthTransactions.filter(t => t.type === 'credito');

    const faturasEmAtraso = (condominio.faturas || []).filter((f: any) => {
      if (f.status === 'PENDENTE' || f.status === 'ATRASADO') {
        const d = f.data_vencimento ? new Date(f.data_vencimento) : new Date();
        const fYear = d.getUTCFullYear();
        const fMonth = d.getUTCMonth() + 1;
        const fMesAno = `${fYear}-${String(fMonth).padStart(2, '0')}`;
        return fMesAno === mesAno || fMesAno < mesAno;
      }
      return false;
    });

    const activeChamadasExtras: any[] = [];

    const pdfBuffer = await generateBalancetePDFBuffer(
      condominio,
      mesAno,
      { saldoAnterior, totalEntradas, totalSaidas, saldoFinal },
      faturasPagas,
      creditosExtras,
      despesasDoMes,
      faturasEmAtraso,
      activeChamadasExtras
    );

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Balancete_${condominio.nome?.replace(/\s+/g, '_') || 'Condominio'}_${month}_${year}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar PDF do balancete:', error);
    return new NextResponse('Erro interno ao gerar PDF', { status: 500 });
  }
}
