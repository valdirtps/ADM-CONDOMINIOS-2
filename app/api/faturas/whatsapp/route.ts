import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { mes_ano } = await req.json();
    if (!mes_ano) {
      return NextResponse.json({ error: 'Mês/Ano não informado' }, { status: 400 });
    }

    let faturas: any[] = [];

    // 1. Try Firebase Firestore
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const [allFaturas, allProprietarios, allCondos] = await Promise.all([
        listDocuments<any>('faturas'),
        listDocuments<any>('proprietarios'),
        listDocuments<any>('condominios'),
      ]);

      if (allFaturas && allFaturas.length > 0) {
        const propMap = new Map((allProprietarios || []).map(p => [p.id, p]));
        const condoMap = new Map((allCondos || []).map(c => [c.id, c]));

        faturas = allFaturas
          .filter(f => (!session.user.condominioId || f.condominioId === session.user.condominioId) && f.mes_ano === mes_ano)
          .map(f => {
            const prop = f.proprietario || propMap.get(f.proprietarioId);
            const condo = f.condominio || condoMap.get(f.condominioId) || { nome: 'Condomínio' };
            return {
              ...f,
              proprietario: prop,
              condominio: { nome: condo.nome || 'Condomínio' },
            };
          })
          .filter(f => f.proprietario && f.proprietario.telefone && String(f.proprietario.telefone).trim() !== '');

        faturas.sort((a, b) => {
          const aptoA = a.proprietario?.apartamento || '';
          const aptoB = b.proprietario?.apartamento || '';
          return aptoA.localeCompare(aptoB, undefined, { numeric: true });
        });
      }
    } catch (fbErr: any) {
      console.warn('Firestore lookup warning in whatsapp route:', fbErr?.message);
    }

    // 2. Fallback to Prisma
    if (faturas.length === 0) {
      try {
        faturas = await prisma.fatura.findMany({
          where: { 
            condominioId: session.user.condominioId,
            mes_ano: mes_ano,
            proprietario: {
              telefone: { not: null, notIn: [''] }
            }
          },
          include: {
            proprietario: true,
            condominio: {
              select: { nome: true }
            }
          },
          orderBy: {
            proprietario: { apartamento: 'asc' }
          }
        });
      } catch (prismaErr: any) {
        console.warn('Prisma lookup failed in whatsapp route:', prismaErr?.message);
      }
    }

    if (faturas.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum proprietário com telefone cadastrado foi encontrado para as faturas deste mês.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ faturas });
  } catch (error) {
    console.error('Erro ao buscar faturas para o WhatsApp:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

