import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const data = await request.json();
    const { tipo, valor, referente, observacao, data_pagamento } = data;

    if (!tipo || !valor || !referente || !data_pagamento) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatórios' }, { status: 400 });
    }

    let existingDespesa: any = null;

    // 1. Try Firebase Firestore
    try {
      const { getDocument } = await import('@/lib/firestore-service');
      existingDespesa = await getDocument<any>('despesas', id);
    } catch (fbErr: any) {
      console.warn('Firestore lookup warning in despesas PUT:', fbErr?.message);
    }

    // 2. Fallback to Prisma
    if (!existingDespesa) {
      try {
        existingDespesa = await prisma.despesa.findUnique({
          where: { id },
          include: { condominio: true }
        });
      } catch (prismaErr: any) {
        console.warn('Prisma lookup failed in despesas PUT:', prismaErr?.message);
      }
    }

    if (!existingDespesa) {
      return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 });
    }

    if (session.user.role !== 'ADMIN_SISTEMA' && existingDespesa.condominioId !== session.user.condominioId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Find active sindico
    let activeSindico: any = null;
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const sindicos = await listDocuments<any>('sindicos');
      activeSindico = (sindicos || []).find(
        s => s.condominioId === existingDespesa.condominioId && s.ativo !== false
      ) || null;
    } catch {}

    if (!activeSindico) {
      try {
        activeSindico = await prisma.sindico.findFirst({
          where: { condominioId: existingDespesa.condominioId, ativo: true }
        });
      } catch {}
    }

    const isDifferentSindico = existingDespesa.sindicoId && activeSindico && existingDespesa.sindicoId !== activeSindico.id;
    const shouldCheckCode = session.user.role !== 'ADMIN_SISTEMA' && isDifferentSindico;

    if (shouldCheckCode) {
      const providedCode = request.headers.get("x-verification-code") || data.codigo_verificacao;
      let creatorSindico: any = null;

      try {
        const { getDocument } = await import('@/lib/firestore-service');
        creatorSindico = await getDocument<any>('sindicos', existingDespesa.sindicoId);
      } catch {}

      if (!creatorSindico) {
        try {
          creatorSindico = await prisma.sindico.findUnique({
            where: { id: existingDespesa.sindicoId! },
            include: { proprietario: true }
          });
        } catch {}
      }

      if (!creatorSindico || !creatorSindico.codigo_verificacao || creatorSindico.codigo_verificacao !== providedCode) {
        return NextResponse.json({
          error: "Código de verificação incorreto ou não fornecido",
          codeRequired: true,
          creatorSindicoId: existingDespesa.sindicoId,
          creatorSindicoEmail: creatorSindico?.email_pessoal || creatorSindico?.proprietario?.email || "sindico@exemplo.com",
          creatorSindicoNome: creatorSindico ? (creatorSindico.empresa_nome || creatorSindico.proprietario?.nome || "Síndico Anterior") : "Síndico Anterior"
        }, { status: 400 });
      }
    }

    const updatedData = {
      ...existingDespesa,
      tipo,
      valor: Number(valor),
      referente,
      observacao: observacao || null,
      data_pagamento: new Date(data_pagamento).toISOString(),
      sindicoId: activeSindico?.id || existingDespesa.sindicoId,
      updatedAt: new Date().toISOString(),
    };

    // 1. Update in Firestore
    try {
      const { setDocument } = await import('@/lib/firestore-service');
      await setDocument('despesas', id, updatedData);
    } catch (fbSaveErr: any) {
      console.error('Error updating despesa in Firestore:', fbSaveErr);
    }

    // 2. Optional sync to Prisma
    try {
      await prisma.despesa.update({
        where: { id },
        data: {
          tipo,
          valor: Number(valor),
          referente,
          observacao: observacao || null,
          data_pagamento: new Date(data_pagamento),
          sindicoId: activeSindico?.id || undefined,
        },
      });
    } catch (prismaSyncErr: any) {
      console.warn('Prisma sync skipped/error in update despesa:', prismaSyncErr?.message);
    }

    return NextResponse.json(updatedData);
  } catch (error: any) {
    console.error('CRITICAL ERROR in PUT /api/despesas/[id]:', error);
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message || String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { id } = await params;

    let existingDespesa: any = null;

    // 1. Try Firebase Firestore
    try {
      const { getDocument } = await import('@/lib/firestore-service');
      existingDespesa = await getDocument<any>('despesas', id);
    } catch (fbErr: any) {
      console.warn('Firestore lookup warning in despesas DELETE:', fbErr?.message);
    }

    // 2. Fallback to Prisma
    if (!existingDespesa) {
      try {
        existingDespesa = await prisma.despesa.findUnique({
          where: { id },
          include: { condominio: true }
        });
      } catch (prismaErr: any) {
        console.warn('Prisma lookup failed in despesas DELETE:', prismaErr?.message);
      }
    }

    if (!existingDespesa) {
      return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 });
    }

    if (session.user.role !== 'ADMIN_SISTEMA' && existingDespesa.condominioId !== session.user.condominioId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    let activeSindico: any = null;
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const sindicos = await listDocuments<any>('sindicos');
      activeSindico = (sindicos || []).find(
        s => s.condominioId === existingDespesa.condominioId && s.ativo !== false
      ) || null;
    } catch {}

    if (!activeSindico) {
      try {
        activeSindico = await prisma.sindico.findFirst({
          where: { condominioId: existingDespesa.condominioId, ativo: true }
        });
      } catch {}
    }

    const isDifferentSindico = existingDespesa.sindicoId && activeSindico && existingDespesa.sindicoId !== activeSindico.id;
    const shouldCheckCode = session.user.role !== 'ADMIN_SISTEMA' && isDifferentSindico;

    if (shouldCheckCode) {
      const urlObj = new URL(request.url);
      const providedCode = request.headers.get("x-verification-code") || urlObj.searchParams.get("codigo_verificacao");
      let creatorSindico: any = null;

      try {
        const { getDocument } = await import('@/lib/firestore-service');
        creatorSindico = await getDocument<any>('sindicos', existingDespesa.sindicoId);
      } catch {}

      if (!creatorSindico) {
        try {
          creatorSindico = await prisma.sindico.findUnique({
            where: { id: existingDespesa.sindicoId! },
            include: { proprietario: true }
          });
        } catch {}
      }

      if (!creatorSindico || !creatorSindico.codigo_verificacao || creatorSindico.codigo_verificacao !== providedCode) {
        return NextResponse.json({
          error: "Código de verificação incorreto ou não fornecido",
          codeRequired: true,
          creatorSindicoId: existingDespesa.sindicoId,
          creatorSindicoEmail: creatorSindico?.email_pessoal || creatorSindico?.proprietario?.email || "sindico@exemplo.com",
          creatorSindicoNome: creatorSindico ? (creatorSindico.empresa_nome || creatorSindico.proprietario?.nome || "Síndico Anterior") : "Síndico Anterior"
        }, { status: 400 });
      }
    }

    // 1. Delete from Firestore
    try {
      const { deleteDocument } = await import('@/lib/firestore-service');
      await deleteDocument('despesas', id);
    } catch (fbDelErr: any) {
      console.error('Error deleting despesa from Firestore:', fbDelErr);
    }

    // 2. Optional delete from Prisma
    try {
      await prisma.despesa.delete({
        where: { id },
      });
    } catch (prismaSyncErr: any) {
      console.warn('Prisma sync skipped/error in delete despesa:', prismaSyncErr?.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir despesa:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

