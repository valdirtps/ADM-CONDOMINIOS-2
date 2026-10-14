import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { valor, referente, mes_ano, data_lancamento } = await req.json();

    // Find the current active property manager (síndico)
    const activeSindico = await prisma.sindico.findFirst({
      where: { condominioId: session.user.condominioId!, ativo: true },
    });

    if (!activeSindico) {
      return NextResponse.json({ 
        error: 'É necessário ter um síndico vigente (ativo) cadastrado para realizar lançamentos.' 
      }, { status: 400 });
    }

    const credito = await prisma.creditoExtra.create({
      data: {
        valor,
        referente,
        mes_ano,
        data_lancamento: data_lancamento ? new Date(data_lancamento) : new Date(),
        condominioId: session.user.condominioId!,
        sindicoId: activeSindico.id,
      },
    });

    return NextResponse.json(credito);
  } catch (error) {
    console.error('Erro ao adicionar crédito extra:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
