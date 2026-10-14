import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const data = await request.json();
    
    if (data.ativo) {
      // Inactivate current sindico
      await prisma.sindico.updateMany({
        where: { condominioId: session.user.condominioId, ativo: true },
        data: { ativo: false, data_fim: new Date() },
      });
    }

    // Create new sindico
    const sindico = await prisma.sindico.create({
      data: {
        proprietarioId: data.proprietarioId,
        empresa_nome: data.proprietarioId ? null : data.empresa_nome,
        email_pessoal: data.email_pessoal,
        data_inicio: new Date(data.data_inicio),
        data_fim: data.data_fim ? new Date(data.data_fim) : null,
        paga_condominio: data.proprietarioId ? data.paga_condominio : true,
        paga_chamada_extra: data.proprietarioId ? data.paga_chamada_extra : true,
        ativo: data.ativo ?? true,
        condominioId: session.user.condominioId,
      },
    });

    return NextResponse.json(sindico);
  } catch (error) {
    console.error('Error creating sindico:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
