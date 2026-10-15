import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const data = await req.json();
    const { mes_ano, referente, valor_total, parcelas, valor } = data;

    let existing: any = null;
    try {
      const { getDocument } = await import('@/lib/firestore-service');
      existing = await getDocument<any>('chamadasExtras', id);
    } catch {}

    if (!existing) {
      try {
        existing = await prisma.chamadaExtra.findUnique({
          where: { id }
        });
      } catch {}
    }

    if (!existing) {
      return NextResponse.json({ error: 'Chamada extra não encontrada' }, { status: 404 });
    }

    let activeSindico: any = null;
    const condoId = existing.condominioId || session.user.condominioId;
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const sindicos = await listDocuments<any>('sindicos');
      activeSindico = (sindicos || []).find(
        s => s.condominioId === condoId && s.ativo !== false
      ) || null;
    } catch {}

    if (!activeSindico) {
      try {
        activeSindico = await prisma.sindico.findFirst({
          where: { condominioId: condoId, ativo: true }
        });
      } catch {}
    }

    if (existing && existing.sindicoId && activeSindico && existing.sindicoId !== activeSindico.id) {
      const providedCode = req.headers.get("x-verification-code") || data.codigo_verificacao;
      let creatorSindico: any = null;

      try {
        const { getDocument } = await import('@/lib/firestore-service');
        creatorSindico = await getDocument<any>('sindicos', existing.sindicoId);
      } catch {}

      if (!creatorSindico) {
        try {
          creatorSindico = await prisma.sindico.findUnique({
            where: { id: existing.sindicoId },
            include: { proprietario: true }
          });
        } catch {}
      }

      if (!creatorSindico || !creatorSindico.codigo_verificacao || creatorSindico.codigo_verificacao !== providedCode) {
        return NextResponse.json({
          error: "Código de verificação incorreto ou não fornecido",
          codeRequired: true,
          creatorSindicoId: existing.sindicoId,
          creatorSindicoEmail: creatorSindico?.email_pessoal || creatorSindico?.proprietario?.email || "sindico@exemplo.com",
          creatorSindicoNome: creatorSindico ? (creatorSindico.empresa_nome || creatorSindico.proprietario?.nome || "Síndico Anterior") : "Síndico Anterior"
        }, { status: 400 });
      }
    }

    const updatedRecord = {
      ...existing,
      mes_ano,
      referente,
      valor_total: Number(valor_total) || 0,
      parcelas: Number(parcelas) || 1,
      valor: Number(valor) || 0,
      sindicoId: activeSindico?.id || existing.sindicoId,
      updatedAt: new Date().toISOString(),
    };

    // 1. Update in Firestore
    try {
      const { setDocument } = await import('@/lib/firestore-service');
      await setDocument('chamadasExtras', id, updatedRecord);
    } catch (fbErr: any) {
      console.error('Error saving chamadaExtra to Firestore:', fbErr);
    }

    // 2. Optional sync to Prisma
    try {
      await prisma.chamadaExtra.update({
        where: { id },
        data: {
          mes_ano,
          referente,
          valor_total: Number(valor_total) || 0,
          parcelas: Number(parcelas) || 1,
          valor: Number(valor) || 0,
          sindicoId: activeSindico?.id || undefined,
        },
      });
    } catch (prismaErr: any) {
      console.warn('Prisma update chamadaExtra skipped/error:', prismaErr?.message);
    }

    return NextResponse.json(updatedRecord);
  } catch (error) {
    console.error('Erro ao atualizar chamada extra:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    let existing: any = null;
    try {
      const { getDocument } = await import('@/lib/firestore-service');
      existing = await getDocument<any>('chamadasExtras', id);
    } catch {}

    if (!existing) {
      try {
        existing = await prisma.chamadaExtra.findUnique({
          where: { id }
        });
      } catch {}
    }

    if (!existing) {
      return NextResponse.json({ error: 'Chamada extra não encontrada' }, { status: 404 });
    }

    let activeSindico: any = null;
    const condoId = existing.condominioId || session.user.condominioId;
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const sindicos = await listDocuments<any>('sindicos');
      activeSindico = (sindicos || []).find(
        s => s.condominioId === condoId && s.ativo !== false
      ) || null;
    } catch {}

    if (!activeSindico) {
      try {
        activeSindico = await prisma.sindico.findFirst({
          where: { condominioId: condoId, ativo: true }
        });
      } catch {}
    }

    if (existing && existing.sindicoId && activeSindico && existing.sindicoId !== activeSindico.id) {
      const urlObj = new URL(req.url);
      const providedCode = req.headers.get("x-verification-code") || urlObj.searchParams.get("codigo_verificacao");
      let creatorSindico: any = null;

      try {
        const { getDocument } = await import('@/lib/firestore-service');
        creatorSindico = await getDocument<any>('sindicos', existing.sindicoId);
      } catch {}

      if (!creatorSindico) {
        try {
          creatorSindico = await prisma.sindico.findUnique({
            where: { id: existing.sindicoId },
            include: { proprietario: true }
          });
        } catch {}
      }

      if (!creatorSindico || !creatorSindico.codigo_verificacao || creatorSindico.codigo_verificacao !== providedCode) {
        return NextResponse.json({
          error: "Código de verificação incorreto ou não fornecido",
          codeRequired: true,
          creatorSindicoId: existing.sindicoId,
          creatorSindicoEmail: creatorSindico?.email_pessoal || creatorSindico?.proprietario?.email || "sindico@exemplo.com",
          creatorSindicoNome: creatorSindico ? (creatorSindico.empresa_nome || creatorSindico.proprietario?.nome || "Síndico Anterior") : "Síndico Anterior"
        }, { status: 400 });
      }
    }

    // 1. Delete from Firestore
    try {
      const { deleteDocument } = await import('@/lib/firestore-service');
      await deleteDocument('chamadasExtras', id);
    } catch (fbDelErr: any) {
      console.error('Error deleting chamadaExtra from Firestore:', fbDelErr);
    }

    // 2. Optional delete from Prisma
    try {
      await prisma.chamadaExtra.delete({
        where: { id },
      });
    } catch (prismaDelErr: any) {
      console.warn('Prisma delete chamadaExtra skipped/error:', prismaDelErr?.message);
    }

    return NextResponse.json({ message: 'Excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir chamada extra:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

