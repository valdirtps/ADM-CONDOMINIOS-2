import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.user.condominioId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const agendas = await prisma.agendaServico.findMany({
      where: {
        condominioId: session.user.condominioId,
      },
      orderBy: {
        data_agendamento: "desc",
      },
    });

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
    const session = await getSession();
    if (!session || (!session.user.condominioId && session.user.role !== 'ADMIN_SISTEMA')) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { titulo, descricao, data_agendamento, condominioId } = body;

    if (!titulo || !data_agendamento) {
      return NextResponse.json({ error: "Título e Data são obrigatórios" }, { status: 400 });
    }

    // Verify date is not in the past
    const agendamentoDate = new Date(data_agendamento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (agendamentoDate < today) {
      return NextResponse.json({ error: "A data de agendamento não pode ser menor que a data atual" }, { status: 400 });
    }

    const agenda = await prisma.agendaServico.create({
      data: {
        titulo,
        descricao,
        data_agendamento: agendamentoDate,
        condominioId: condominioId || session.user.condominioId,
      },
    });

    return NextResponse.json(agenda);
  } catch (error) {
    console.error("[AGENDAS_POST]", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
