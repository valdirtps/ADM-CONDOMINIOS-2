import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const data = await request.json();
    
    if (!data.mes_ano) {
      return NextResponse.json({ error: 'Mês/Ano é obrigatório' }, { status: 400 });
    }

    const condominioId = session.user.condominioId;
    if (!condominioId) {
      return NextResponse.json({ error: 'Condomínio não informado' }, { status: 400 });
    }

    // 1. Find the current active property manager (síndico)
    let activeSindico: any = null;
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const sindicos = await listDocuments<any>('sindicos');
      activeSindico = (sindicos || []).find(
        s => s.condominioId === condominioId && s.ativo !== false
      ) || null;
    } catch {}

    if (!activeSindico) {
      try {
        activeSindico = await prisma.sindico.findFirst({
          where: { condominioId, ativo: true },
        });
      } catch {}
    }

    if (!activeSindico) {
      return NextResponse.json({ 
        error: 'É necessário ter um síndico vigente (ativo) cadastrado para realizar lançamentos.' 
      }, { status: 400 });
    }

    // 2. Check existing record
    let existing: any = null;
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const vmList = await listDocuments<any>('valoresMensais');
      existing = (vmList || []).find(
        v => v.mes_ano === data.mes_ano && v.condominioId === condominioId
      ) || null;
    } catch {}

    if (!existing) {
      try {
        existing = await prisma.valoresMensais.findUnique({
          where: {
            mes_ano_condominioId: {
              mes_ano: data.mes_ano,
              condominioId,
            }
          }
        });
      } catch {}
    }

    // 3. Security check if different manager
    if (existing && existing.sindicoId && activeSindico && existing.sindicoId !== activeSindico.id) {
      const providedCode = request.headers.get("x-verification-code") || data.codigo_verificacao;
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

    const docId = existing?.id || crypto.randomUUID();
    const updatedRecord = {
      ...(existing || {}),
      id: docId,
      mes_ano: data.mes_ano,
      valor_agua: Number(data.valor_agua) || 0,
      valor_luz: Number(data.valor_luz) || 0,
      fundo_reserva: Number(data.fundo_reserva) || 0,
      taxa_condominio: Number(data.taxa_condominio) || 0,
      observacao: data.observacao || null,
      condominioId,
      sindicoId: activeSindico.id,
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    // 1. Save in Firestore
    try {
      const { setDocument } = await import('@/lib/firestore-service');
      await setDocument('valoresMensais', docId, updatedRecord);
    } catch (fbSaveErr: any) {
      console.error('Error saving valoresMensais to Firestore:', fbSaveErr);
    }

    // 2. Optional sync to Prisma
    try {
      await prisma.valoresMensais.upsert({
        where: {
          mes_ano_condominioId: {
            mes_ano: data.mes_ano,
            condominioId,
          }
        },
        update: {
          valor_agua: Number(data.valor_agua) || 0,
          valor_luz: Number(data.valor_luz) || 0,
          fundo_reserva: Number(data.fundo_reserva) || 0,
          taxa_condominio: Number(data.taxa_condominio) || 0,
          observacao: data.observacao || null,
          sindicoId: activeSindico.id,
        },
        create: {
          id: docId,
          mes_ano: data.mes_ano,
          valor_agua: Number(data.valor_agua) || 0,
          valor_luz: Number(data.valor_luz) || 0,
          fundo_reserva: Number(data.fundo_reserva) || 0,
          taxa_condominio: Number(data.taxa_condominio) || 0,
          observacao: data.observacao || null,
          condominioId,
          sindicoId: activeSindico.id,
        },
      });
    } catch (prismaSyncErr: any) {
      console.warn('Prisma sync skipped/error in valoresMensais:', prismaSyncErr?.message);
    }

    return NextResponse.json(updatedRecord);
  } catch (error) {
    console.error('Error creating valores mensais:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

