import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const data = await request.json();
    
    if (!data.mes_ano) {
      return NextResponse.json({ error: 'Mês/Ano é obrigatório' }, { status: 400 });
    }

    // 1. Find the current active property manager (síndico)
    const activeSindico = await prisma.sindico.findFirst({
      where: { condominioId: session.user.condominioId, ativo: true },
    });

    if (!activeSindico) {
      return NextResponse.json({ 
        error: 'É necessário ter um síndico vigente (ativo) cadastrado para realizar lançamentos.' 
      }, { status: 400 });
    }

    // 2. Check if a record already exists
    const existing = await prisma.valoresMensais.findUnique({
      where: {
        mes_ano_condominioId: {
          mes_ano: data.mes_ano,
          condominioId: session.user.condominioId,
        }
      }
    });

    // 3. If there is an existing record created by a DIFFERENT manager, check the verification code
    if (existing && existing.sindicoId && activeSindico && existing.sindicoId !== activeSindico.id) {
      const providedCode = request.headers.get("x-verification-code") || data.codigo_verificacao;
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

    const valores = await prisma.valoresMensais.upsert({
      where: {
        mes_ano_condominioId: {
          mes_ano: data.mes_ano,
          condominioId: session.user.condominioId,
        }
      },
      update: {
        valor_agua: Number(data.valor_agua),
        valor_luz: Number(data.valor_luz),
        fundo_reserva: Number(data.fundo_reserva),
        taxa_condominio: Number(data.taxa_condominio),
        observacao: data.observacao,
        sindicoId: activeSindico.id, // associated to whoever updated it now
      },
      create: {
        mes_ano: data.mes_ano,
        valor_agua: Number(data.valor_agua),
        valor_luz: Number(data.valor_luz),
        fundo_reserva: Number(data.fundo_reserva),
        taxa_condominio: Number(data.taxa_condominio),
        observacao: data.observacao,
        condominioId: session.user.condominioId,
        sindicoId: activeSindico.id,
      },
    });

    return NextResponse.json(valores);
  } catch (error) {
    console.error('Error creating valores mensais:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
