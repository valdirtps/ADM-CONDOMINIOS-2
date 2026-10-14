import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (!session.user.condominioId && session.user.role !== 'ADMIN_SISTEMA')) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const resolvedParams = await params;
    const body = await request.json();
    const { titulo, descricao, data_agendamento, status } = body;

    const existingAgenda = await prisma.agendaServico.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!existingAgenda) {
      return NextResponse.json({ error: "Agenda não encontrada" }, { status: 404 });
    }

    if (existingAgenda.condominioId !== session.user.condominioId && session.user.role !== 'ADMIN_SISTEMA') {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    if (data_agendamento) {
      const agendamentoDate = new Date(data_agendamento);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Only check if they are changing the date
      if (agendamentoDate.getTime() !== existingAgenda.data_agendamento.getTime()) {
        if (agendamentoDate < today) {
           return NextResponse.json({ error: "A data de agendamento não pode ser menor que a data atual" }, { status: 400 });
        }
      }
    }

    const agenda = await prisma.agendaServico.update({
      where: {
        id: resolvedParams.id,
      },
      data: {
        titulo,
        descricao,
        data_agendamento: data_agendamento ? new Date(data_agendamento) : undefined,
        status,
      },
    });

    return NextResponse.json(agenda);
  } catch (error) {
    console.error("[AGENDA_PATCH]", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (!session.user.condominioId && session.user.role !== 'ADMIN_SISTEMA')) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const resolvedParams = await params;
    
    const existingAgenda = await prisma.agendaServico.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!existingAgenda) {
      return NextResponse.json({ error: "Agenda não encontrada" }, { status: 404 });
    }

    if (existingAgenda.condominioId !== session.user.condominioId && session.user.role !== 'ADMIN_SISTEMA') {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const agenda = await prisma.agendaServico.delete({
      where: {
        id: resolvedParams.id,
      },
    });

    return NextResponse.json(agenda);
  } catch (error) {
    console.error("[AGENDA_DELETE]", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
