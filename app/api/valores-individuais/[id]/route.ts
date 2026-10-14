import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const data = await req.json();
    const { proprietarioId, valor, descricao, mes_ano } = data;

    const existing = await prisma.valoresIndividuais.findUnique({
      where: { id, condominioId: session.user.condominioId }
    });

    const activeSindico = await prisma.sindico.findFirst({
      where: { condominioId: session.user.condominioId, ativo: true }
    });

    if (existing && existing.sindicoId && activeSindico && existing.sindicoId !== activeSindico.id) {
      const providedCode = req.headers.get("x-verification-code") || data.codigo_verificacao;
      const creatorSindico = await prisma.sindico.findUnique({
        where: { id: existing.sindicoId },
        include: { proprietario: true }
      });

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

    const valorInd = await prisma.valoresIndividuais.update({
      where: { id, condominioId: session.user.condominioId },
      data: {
        proprietarioId,
        valor: parseFloat(valor),
        descricao,
        mes_ano,
        sindicoId: activeSindico?.id || undefined,
      }
    });

    return NextResponse.json({ success: true, data: valorInd });
  } catch (error) {
    console.error('Failed to update valor individual:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.valoresIndividuais.findUnique({
      where: { id, condominioId: session.user.condominioId }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const activeSindico = await prisma.sindico.findFirst({
      where: { condominioId: session.user.condominioId, ativo: true }
    });

    if (existing.sindicoId && activeSindico && existing.sindicoId !== activeSindico.id) {
      const urlObj = new URL(req.url);
      const providedCode = req.headers.get("x-verification-code") || urlObj.searchParams.get("codigo_verificacao");
      const creatorSindico = await prisma.sindico.findUnique({
        where: { id: existing.sindicoId },
        include: { proprietario: true }
      });

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

    await prisma.valoresIndividuais.delete({
      where: { id, condominioId: session.user.condominioId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete valor individual:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
