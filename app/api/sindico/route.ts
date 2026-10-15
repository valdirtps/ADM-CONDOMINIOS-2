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

    const isAtivo = data.ativo ?? true;

    // 1. Inactivate existing active sindicos in Firestore if this one is active
    try {
      const { listDocuments, setDocument } = await import('@/lib/firestore-service');
      if (isAtivo) {
        const sindicos = await listDocuments<any>('sindicos');
        const activeSindicos = (sindicos || []).filter(
          s => s.condominioId === condominioId && s.ativo !== false
        );
        for (const s of activeSindicos) {
          await setDocument('sindicos', s.id, {
            ...s,
            ativo: false,
            data_fim: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      const newId = crypto.randomUUID();
      const newSindico = {
        id: newId,
        proprietarioId: data.proprietarioId || null,
        empresa_nome: data.proprietarioId ? null : (data.empresa_nome || null),
        email_pessoal: data.email_pessoal || '',
        data_inicio: new Date(data.data_inicio).toISOString(),
        data_fim: data.data_fim ? new Date(data.data_fim).toISOString() : null,
        paga_condominio: data.proprietarioId ? (data.paga_condominio ?? true) : true,
        paga_chamada_extra: data.proprietarioId ? (data.paga_chamada_extra ?? true) : true,
        ativo: isAtivo,
        condominioId,
        codigo_verificacao: data.codigo_verificacao || Math.floor(100000 + Math.random() * 900000).toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDocument('sindicos', newId, newSindico);

      // Optional sync to Prisma
      try {
        if (isAtivo) {
          await prisma.sindico.updateMany({
            where: { condominioId, ativo: true },
            data: { ativo: false, data_fim: new Date() },
          });
        }

        await prisma.sindico.create({
          data: {
            id: newId,
            proprietarioId: data.proprietarioId || null,
            empresa_nome: data.proprietarioId ? null : data.empresa_nome,
            email_pessoal: data.email_pessoal || '',
            data_inicio: new Date(data.data_inicio),
            data_fim: data.data_fim ? new Date(data.data_fim) : null,
            paga_condominio: data.proprietarioId ? data.paga_condominio : true,
            paga_chamada_extra: data.proprietarioId ? data.paga_chamada_extra : true,
            ativo: isAtivo,
            condominioId,
            codigo_verificacao: newSindico.codigo_verificacao,
          },
        });
      } catch (prismaErr: any) {
        console.warn('Prisma create sindico skipped/error:', prismaErr?.message);
      }

      return NextResponse.json(newSindico);
    } catch (fbErr: any) {
      console.error('Error creating sindico in Firestore:', fbErr);
    }

    return NextResponse.json({ error: 'Erro ao criar síndico' }, { status: 500 });
  } catch (error) {
    console.error('Error creating sindico:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

