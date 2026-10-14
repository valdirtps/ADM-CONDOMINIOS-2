import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await params;
    const data = await request.json();

    // If setting to active, inactivate others
    if (data.ativo) {
      await prisma.sindico.updateMany({
        where: { 
          condominioId: session.user.condominioId, 
          ativo: true,
          id: { not: id }
        },
        data: { ativo: false, data_fim: new Date() },
      });
    }

    const sindico = await prisma.sindico.update({
      where: { id },
      data: {
        proprietarioId: data.proprietarioId,
        empresa_nome: data.proprietarioId ? null : data.empresa_nome,
        email_pessoal: data.email_pessoal,
        data_inicio: new Date(data.data_inicio),
        data_fim: data.data_fim ? new Date(data.data_fim) : null,
        paga_condominio: data.proprietarioId ? data.paga_condominio : true,
        paga_chamada_extra: data.proprietarioId ? data.paga_chamada_extra : true,
        ativo: data.ativo,
      },
    });

    return NextResponse.json(sindico);
  } catch (error) {
    console.error('Error updating sindico:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
