import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await params;
    const data = await request.json();
    const condominioId = session.user.condominioId;

    let existing: any = null;
    try {
      const { getDocument } = await import('@/lib/firestore-service');
      existing = await getDocument<any>('sindicos', id);
    } catch {}

    if (!existing) {
      try {
        existing = await prisma.sindico.findUnique({
          where: { id }
        });
      } catch {}
    }

    if (!existing) {
      return NextResponse.json({ error: 'Síndico não encontrado' }, { status: 404 });
    }

    const condoId = existing.condominioId || condominioId;

    // 1. If setting to active, inactivate others in Firestore
    try {
      const { listDocuments, setDocument } = await import('@/lib/firestore-service');
      if (data.ativo) {
        const sindicos = await listDocuments<any>('sindicos');
        const others = (sindicos || []).filter(
          s => s.condominioId === condoId && s.id !== id && s.ativo !== false
        );
        for (const s of others) {
          await setDocument('sindicos', s.id, {
            ...s,
            ativo: false,
            data_fim: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      const updatedRecord = {
        ...existing,
        proprietarioId: data.proprietarioId || null,
        empresa_nome: data.proprietarioId ? null : (data.empresa_nome || null),
        email_pessoal: data.email_pessoal || '',
        data_inicio: new Date(data.data_inicio).toISOString(),
        data_fim: data.data_fim ? new Date(data.data_fim).toISOString() : null,
        paga_condominio: data.proprietarioId ? (data.paga_condominio ?? true) : true,
        paga_chamada_extra: data.proprietarioId ? (data.paga_chamada_extra ?? true) : true,
        ativo: data.ativo ?? true,
        updatedAt: new Date().toISOString(),
      };

      await setDocument('sindicos', id, updatedRecord);

      // Optional sync to Prisma
      try {
        if (data.ativo) {
          await prisma.sindico.updateMany({
            where: { 
              condominioId: condoId, 
              ativo: true,
              id: { not: id }
            },
            data: { ativo: false, data_fim: new Date() },
          });
        }

        await prisma.sindico.update({
          where: { id },
          data: {
            proprietarioId: data.proprietarioId || null,
            empresa_nome: data.proprietarioId ? null : data.empresa_nome,
            email_pessoal: data.email_pessoal || '',
            data_inicio: new Date(data.data_inicio),
            data_fim: data.data_fim ? new Date(data.data_fim) : null,
            paga_condominio: data.proprietarioId ? data.paga_condominio : true,
            paga_chamada_extra: data.proprietarioId ? data.paga_chamada_extra : true,
            ativo: data.ativo,
          },
        });
      } catch (prismaErr: any) {
        console.warn('Prisma update sindico skipped/error:', prismaErr?.message);
      }

      return NextResponse.json(updatedRecord);
    } catch (fbErr: any) {
      console.error('Error updating sindico in Firestore:', fbErr);
    }

    return NextResponse.json({ error: 'Erro ao atualizar síndico' }, { status: 500 });
  } catch (error) {
    console.error('Error updating sindico:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

