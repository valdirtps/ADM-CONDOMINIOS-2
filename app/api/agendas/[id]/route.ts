import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session || (!session.user.condominioId && session.user.role !== 'ADMIN_SISTEMA')) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const resolvedParams = await params;
    const body = await request.json();
    const { titulo, descricao, data_agendamento, status } = body;

    let existingAgenda: any = null;
    try {
      const { getDocument } = await import('@/lib/firestore-service');
      existingAgenda = await getDocument<any>('agendasServico', resolvedParams.id);
    } catch {}

    if (!existingAgenda) {
      try {
        existingAgenda = await prisma.agendaServico.findUnique({
          where: { id: resolvedParams.id },
        });
      } catch {}
    }

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

      const existingDate = new Date(existingAgenda.data_agendamento);
      if (agendamentoDate.getTime() !== existingDate.getTime()) {
        if (agendamentoDate < today) {
           return NextResponse.json({ error: "A data de agendamento não pode ser menor que a data atual" }, { status: 400 });
        }
      }
    }

    const updatedRecord = {
      ...existingAgenda,
      titulo: titulo ?? existingAgenda.titulo,
      descricao: descricao !== undefined ? descricao : existingAgenda.descricao,
      data_agendamento: data_agendamento ? new Date(data_agendamento).toISOString() : existingAgenda.data_agendamento,
      status: status ?? existingAgenda.status,
      updatedAt: new Date().toISOString(),
    };

    // 1. Update in Firestore
    try {
      const { setDocument } = await import('@/lib/firestore-service');
      await setDocument('agendasServico', resolvedParams.id, updatedRecord);
    } catch (fbErr: any) {
      console.error('Error saving agenda to Firestore:', fbErr);
    }

    // 2. Optional sync to Prisma
    try {
      await prisma.agendaServico.update({
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
    } catch (prismaErr: any) {
      console.warn('Prisma update agenda skipped/error:', prismaErr?.message);
    }

    return NextResponse.json(updatedRecord);
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
    const session = await getSession(request);
    if (!session || (!session.user.condominioId && session.user.role !== 'ADMIN_SISTEMA')) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const resolvedParams = await params;
    
    let existingAgenda: any = null;
    try {
      const { getDocument } = await import('@/lib/firestore-service');
      existingAgenda = await getDocument<any>('agendasServico', resolvedParams.id);
    } catch {}

    if (!existingAgenda) {
      try {
        existingAgenda = await prisma.agendaServico.findUnique({
          where: { id: resolvedParams.id },
        });
      } catch {}
    }

    if (!existingAgenda) {
      return NextResponse.json({ error: "Agenda não encontrada" }, { status: 404 });
    }

    if (existingAgenda.condominioId !== session.user.condominioId && session.user.role !== 'ADMIN_SISTEMA') {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // 1. Delete from Firestore
    try {
      const { deleteDocument } = await import('@/lib/firestore-service');
      await deleteDocument('agendasServico', resolvedParams.id);
    } catch (fbDelErr: any) {
      console.error('Error deleting agenda from Firestore:', fbDelErr);
    }

    // 2. Optional delete from Prisma
    try {
      await prisma.agendaServico.delete({
        where: {
          id: resolvedParams.id,
        },
      });
    } catch (prismaDelErr: any) {
      console.warn('Prisma delete agenda skipped/error:', prismaDelErr?.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AGENDA_DELETE]", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

