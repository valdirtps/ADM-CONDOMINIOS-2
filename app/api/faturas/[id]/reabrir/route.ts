import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = cleanUndefined(value);
    }
  }
  return result;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    let fatura: any = null;

    // 1. Try Firebase Firestore
    try {
      const { getDocument } = await import('@/lib/firestore-service');
      fatura = await getDocument<any>('faturas', id);
    } catch (fbErr: any) {
      console.warn('Firestore lookup warning in reabrir:', fbErr?.message);
    }

    // 2. Fallback to Prisma
    if (!fatura) {
      try {
        fatura = await prisma.fatura.findUnique({
          where: { id },
        });
      } catch (prismaErr: any) {
        console.warn('Prisma lookup failed in reabrir:', prismaErr?.message);
      }
    }

    if (!fatura) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
    }

    if (session.user.role !== 'ADMIN_SISTEMA' && session.user.condominioId && fatura.condominioId && fatura.condominioId !== session.user.condominioId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    if (fatura.status !== 'PAGO') {
      return NextResponse.json({ error: 'Apenas faturas pagas podem ser reabertas' }, { status: 400 });
    }

    let targetDesc = '';
    if (fatura.data_pagamento) {
      try {
        const { format } = await import('date-fns');
        const d = new Date(fatura.data_pagamento);
        const dataPgtoFormatada = format(new Date(d.getTime() + new Date().getTimezoneOffset() * 60000), 'dd/MM/yyyy');
        targetDesc = `Multa/Juros por Atraso (Pgto em ${dataPgtoFormatada})`;
      } catch {}
    }

    // 1. Update in Firestore
    try {
      const { setDocument, listDocuments, deleteDocument } = await import('@/lib/firestore-service');
      
      if (targetDesc) {
        const viList = await listDocuments<any>('valoresIndividuais');
        const toDelete = (viList || []).filter(
          v => v.proprietarioId === fatura.proprietarioId && v.descricao === targetDesc
        );
        for (const item of toDelete) {
          await deleteDocument('valoresIndividuais', item.id);
        }
      }

      const { proprietario, ...faturaRaw } = fatura;

      await setDocument('faturas', id, cleanUndefined({
        ...faturaRaw,
        status: 'PENDENTE',
        data_pagamento: null,
        valor_pago: null,
        multa: 0,
        juros: 0,
        dias_atraso: 0,
        updatedAt: new Date().toISOString(),
      }));
    } catch (fbSaveErr: any) {
      console.error('Error reopening fatura in Firestore:', fbSaveErr);
      return NextResponse.json({ error: 'Erro ao reabrir fatura no banco de dados' }, { status: 500 });
    }

    // 2. Optional non-blocking sync to Prisma
    (async () => {
      try {
        if (targetDesc) {
          await prisma.valoresIndividuais.deleteMany({
            where: {
              proprietarioId: fatura.proprietarioId,
              condominioId: fatura.condominioId || session.user.condominioId,
              descricao: targetDesc,
            },
          });
        }

        await prisma.fatura.update({
          where: { id },
          data: {
            status: 'PENDENTE',
            data_pagamento: null,
            valor_pago: null,
            multa: 0,
            juros: 0,
            dias_atraso: 0,
          },
        });
      } catch (prismaSyncErr: any) {
        // Prisma sync bypassed
      }
    })().catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error reopening fatura:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
