import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const data = await req.json();
    const { valor, referente, mes_ano, data_lancamento } = data;

    const existing = await prisma.creditoExtra.findUnique({
      where: { id }
    });

    const activeSindico = await prisma.sindico.findFirst({
      where: { condominioId: session.user.condominioId!, ativo: true }
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

    const credito = await prisma.creditoExtra.update({
      where: { id },
      data: {
        valor,
        referente,
        mes_ano,
        data_lancamento: data_lancamento ? new Date(data_lancamento) : undefined,
        sindicoId: activeSindico?.id || undefined,
      },
    });

    return NextResponse.json(credito);
  } catch (error) {
    console.error('Erro ao atualizar crédito extra:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.creditoExtra.findUnique({
      where: { id }
    });

    const activeSindico = await prisma.sindico.findFirst({
      where: { condominioId: session.user.condominioId!, ativo: true }
    });

    if (existing && existing.sindicoId && activeSindico && existing.sindicoId !== activeSindico.id) {
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

    await prisma.creditoExtra.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir crédito extra:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
