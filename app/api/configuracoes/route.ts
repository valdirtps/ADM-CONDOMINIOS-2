import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const data = await request.json();
    const condominioId = session.user.condominioId;
    if (!condominioId) {
      return NextResponse.json({ error: 'Condomínio não informado' }, { status: 400 });
    }

    let existingParametro: any = null;
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const paramsList = await listDocuments<any>('parametros');
      existingParametro = (paramsList || []).find(
        p => p.condominioId === condominioId && p.mes_ano === data.mes_ano
      ) || null;
    } catch {}

    if (!existingParametro) {
      try {
        existingParametro = await prisma.parametros.findUnique({
          where: {
            condominioId_mes_ano: {
              condominioId,
              mes_ano: data.mes_ano
            }
          }
        });
      } catch {}
    }

    if (existingParametro) {
      // Check if there are any linked records for this mes_ano
      let hasLinkedData = false;
      try {
        const { listDocuments } = await import('@/lib/firestore-service');
        const [fList, vmList, ceList, viList] = await Promise.all([
          listDocuments<any>('faturas'),
          listDocuments<any>('valoresMensais'),
          listDocuments<any>('chamadasExtras'),
          listDocuments<any>('valoresIndividuais'),
        ]);

        const fCount = (fList || []).filter(f => f.condominioId === condominioId && f.mes_ano === data.mes_ano).length;
        const vmCount = (vmList || []).filter(v => v.condominioId === condominioId && v.mes_ano === data.mes_ano).length;
        const ceCount = (ceList || []).filter(c => c.condominioId === condominioId && c.mes_ano === data.mes_ano).length;
        const viCount = (viList || []).filter(vi => vi.condominioId === condominioId && vi.mes_ano === data.mes_ano).length;

        hasLinkedData = (fCount + vmCount + ceCount + viCount) > 0;
      } catch {}

      if (hasLinkedData) {
        return NextResponse.json({ error: 'Não é possível alterar as configurações pois já existem lançamentos vinculados a este período.' }, { status: 400 });
      }
    }

    const docId = existingParametro?.id || crypto.randomUUID();
    const updatedParametro = {
      ...(existingParametro || {}),
      id: docId,
      mes_ano: data.mes_ano,
      dia_vencimento: Number(data.dia_vencimento) || 10,
      dias_isencao_multa: Number(data.dias_isencao_multa) || 0,
      multa_percentual: Number(data.multa_percentual) || 0,
      dividir_rateio_menos_um: Boolean(data.dividir_rateio_menos_um),
      condominioId,
      updatedAt: new Date().toISOString(),
      createdAt: existingParametro?.createdAt || new Date().toISOString(),
    };

    // 1. Save to Firebase Firestore
    try {
      const { setDocument } = await import('@/lib/firestore-service');
      await setDocument('parametros', docId, updatedParametro);
    } catch (fbErr: any) {
      console.error('Error saving parametros to Firestore:', fbErr);
    }

    // 2. Optional sync to Prisma
    try {
      await prisma.parametros.upsert({
        where: { 
          condominioId_mes_ano: {
            condominioId,
            mes_ano: data.mes_ano
          }
        },
        update: {
          dia_vencimento: Number(data.dia_vencimento) || 10,
          dias_isencao_multa: Number(data.dias_isencao_multa) || 0,
          multa_percentual: Number(data.multa_percentual) || 0,
          dividir_rateio_menos_um: Boolean(data.dividir_rateio_menos_um),
        },
        create: {
          id: docId,
          mes_ano: data.mes_ano,
          dia_vencimento: Number(data.dia_vencimento) || 10,
          dias_isencao_multa: Number(data.dias_isencao_multa) || 0,
          multa_percentual: Number(data.multa_percentual) || 0,
          dividir_rateio_menos_um: Boolean(data.dividir_rateio_menos_um),
          condominioId,
        },
      });
    } catch (prismaErr: any) {
      console.warn('Prisma upsert parametros skipped/error:', prismaErr?.message);
    }

    return NextResponse.json(updatedParametro);
  } catch (error) {
    console.error('Error updating parametros:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

