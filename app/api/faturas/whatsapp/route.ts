import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { mes_ano } = await req.json();
    if (!mes_ano) {
      return NextResponse.json({ error: 'Mês/Ano não informado' }, { status: 400 });
    }

    // Busca todas as faturas do condomínio com telefone cadastrado
    const faturas = await prisma.fatura.findMany({
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
