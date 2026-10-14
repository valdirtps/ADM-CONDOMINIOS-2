import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { proprietarioId, mes_ano, valor, descricao } = data;

    if (!proprietarioId || !mes_ano || valor === undefined || !descricao) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find the current active property manager (síndico)
    const activeSindico = await prisma.sindico.findFirst({
      where: { condominioId: session.user.condominioId, ativo: true },
    });

    if (!activeSindico) {
      return NextResponse.json({ 
        error: 'É necessário ter um síndico vigente (ativo) cadastrado para realizar lançamentos.' 
      }, { status: 400 });
    }
    
    const valorInd = await prisma.valoresIndividuais.create({
      data: {
        proprietarioId,
        mes_ano,
        valor: Number(valor),
        descricao,
        condominioId: session.user.condominioId,
        sindicoId: activeSindico.id,
      }
    });

    return NextResponse.json(valorInd);
  } catch (error) {
    console.error('Failed to create valor individual:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
