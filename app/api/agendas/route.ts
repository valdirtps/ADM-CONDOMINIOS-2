import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import crypto from "crypto";

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session || !session.user.condominioId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const condominioId = session.user.condominioId;
    let agendas: any[] = [];

    // 1. Try Firebase Firestore
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const docs = await listDocuments<any>('agendasServico');
      agendas = (docs || []).filter(a => a.condominioId === condominioId);
      agendas.sort((a, b) => {
        const timeA = a.data_agendamento ? new Date(a.data_agendamento).getTime() : 0;
        const timeB = b.data_agendamento ? new Date(b.data_agendamento).getTime() : 0;
        return timeB - timeA;
      });
    } catch (fbErr: any) {
      console.warn('Firestore lookup warning in agendas GET:', fbErr?.message);
    }

    // 2. Fallback to Prisma
    if (agendas.length === 0) {
      try {
        agendas = await prisma.agendaServico.findMany({
          where: {
            condominioId,
          },
          orderBy: {
            data_agendamento: "desc",
          },
        });
      } catch (prismaErr: any) {
        console.warn('Prisma lookup failed in agendas GET:', prismaErr?.message);
      }
    }

    return NextResponse.json(agendas);
  } catch (error) {
    console.error("[AGENDAS_GET]", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session || (!session.user.condominioId && session.user.role !== 'ADMIN_SISTEMA')) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { titulo, descricao, data_agendamento, condominioId } = body;

    if (!titulo || !data_agendamento) {
      return NextResponse.json({ error: "Título e Data são obrigatórios" }, { status: 400 });
    }

    const targetCondoId = condominioId || session.user.condominioId;

    // Verify date is not in the past
    const agendamentoDate = new Date(data_agendamento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (agendamentoDate < today) {
      return NextResponse.json({ error: "A data de agendamento não pode ser menor que a data atual" }, { status: 400 });
    }

    const newId = crypto.randomUUID();
    const newRecord = {
      id: newId,
      titulo,
      descricao: descricao || '',
      data_agendamento: agendamentoDate.toISOString(),
      status: "AGENDADO",
      condominioId: targetCondoId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Save to Firestore
    try {
      const { setDocument } = await import('@/lib/firestore-service');
      await setDocument('agendasServico', newId, newRecord);
    } catch (fbErr: any) {
      console.error('Error saving agenda to Firestore:', fbErr);
    }

    // 2. Optional sync to Prisma
    try {
      await prisma.agendaServico.create({
        data: {
          id: newId,
          titulo,
          descricao,
          data_agendamento: agendamentoDate,
          condominioId: targetCondoId,
        },
      });
    } catch (prismaErr: any) {
      console.warn('Prisma create agenda skipped/error:', prismaErr?.message);
    }

    return NextResponse.json(newRecord);
  } catch (error) {
    console.error("[AGENDAS_POST]", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

