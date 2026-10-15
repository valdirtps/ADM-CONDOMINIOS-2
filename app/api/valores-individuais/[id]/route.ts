import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const data = await req.json();
    const { proprietarioId, valor, descricao, mes_ano } = data;

    let existing: any = null;
    try {
      const { getDocument } = await import('@/lib/firestore-service');
      existing = await getDocument<any>('valoresIndividuais', id);
    } catch {}

    if (!existing) {
      try {
        existing = await prisma.valoresIndividuais.findUnique({
          where: { id }
        });
      } catch {}
    }

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
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
      proprietarioId: proprietarioId || existing.proprietarioId,
      valor: parseFloat(valor) || 0,
      descricao: descricao || existing.descricao,
      mes_ano: mes_ano || existing.mes_ano,
      sindicoId: activeSindico?.id || existing.sindicoId,
      updatedAt: new Date().toISOString(),
    };

    // 1. Update in Firestore
    try {
      const { setDocument } = await import('@/lib/firestore-service');
      await setDocument('valoresIndividuais', id, updatedRecord);
    } catch (fbErr: any) {
      console.error('Error updating valorIndividual in Firestore:', fbErr);
    }

    // 2. Optional sync to Prisma
    try {
      await prisma.valoresIndividuais.update({
        where: { id },
        data: {
          proprietarioId: proprietarioId || undefined,
          valor: parseFloat(valor),
          descricao,
          mes_ano,
          sindicoId: activeSindico?.id || undefined,
        }
      });
    } catch (prismaErr: any) {
      console.warn('Prisma update valorIndividual skipped/error:', prismaErr?.message);
    }

    return NextResponse.json({ success: true, data: updatedRecord });
  } catch (error) {
    console.error('Failed to update valor individual:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    let existing: any = null;
    try {
      const { getDocument } = await import('@/lib/firestore-service');
      existing = await getDocument<any>('valoresIndividuais', id);
    } catch {}

    if (!existing) {
      try {
        existing = await prisma.valoresIndividuais.findUnique({
          where: { id }
        });
      } catch {}
    }

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
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

    if (existing.sindicoId && activeSindico && existing.sindicoId !== activeSindico.id) {
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
      await deleteDocument('valoresIndividuais', id);
    } catch (fbDelErr: any) {
      console.error('Error deleting valorIndividual from Firestore:', fbDelErr);
    }

    // 2. Optional delete from Prisma
    try {
      await prisma.valoresIndividuais.delete({
        where: { id }
      });
    } catch (prismaDelErr: any) {
      console.warn('Prisma delete valorIndividual skipped/error:', prismaDelErr?.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete valor individual:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

