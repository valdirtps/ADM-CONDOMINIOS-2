import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import crypto from "crypto";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const data = await request.json();

    if (!data.nome || !data.apartamento) {
      return NextResponse.json(
        { error: "Nome e apartamento são obrigatórios" },
        { status: 400 },
      );
    }

    const aptoTrimmed = String(data.apartamento).trim();
    const nomeTrimmed = String(data.nome).trim();
    const telefoneTrimmed = data.telefone ? String(data.telefone).trim() : "";
    const emailTrimmed = data.email ? String(data.email).trim() : "";
    const saldoNum = Number(data.saldo_devedor_inicial) || 0;
    const condominioId = session.user.condominioId || "";

    // 1. Check duplicate apartment in Firestore
    let isDuplicate = false;
    try {
      const { listDocuments } = await import("@/lib/firestore-service");
      const docs = await listDocuments<any>("proprietarios");
      if (docs && docs.length > 0) {
        const found = docs.find(
          (p) =>
            p.id !== id &&
            p.apartamento?.trim().toLowerCase() === aptoTrimmed.toLowerCase() &&
            p.ativo !== false &&
            (!condominioId || !p.condominioId || p.condominioId === condominioId),
        );
        if (found) isDuplicate = true;
      }
    } catch (e: any) {
      console.warn("Firestore duplicate check error:", e?.message);
    }

    // Fallback duplicate check via Prisma if possible
    if (!isDuplicate) {
      try {
        const existingProp = await prisma.proprietario.findFirst({
          where: {
            condominioId,
            apartamento: aptoTrimmed,
            id: { not: id },
            ativo: true,
          },
        });
        if (existingProp) isDuplicate = true;
      } catch {}
    }

    if (isDuplicate) {
      return NextResponse.json(
        { error: "Já existe um proprietário ativo para este apartamento" },
        { status: 400 },
      );
    }

    let updatedProprietario: any = null;
    const nowIso = new Date().toISOString();

    // 2. Perform Update or Transfer in Firestore
    try {
      const { setDocument, getDocument } = await import("@/lib/firestore-service");

      if (data.mudancaProprietario) {
        // Freeze existing record: mark inactive
        const oldDoc = await getDocument<any>("proprietarios", id);
        await setDocument("proprietarios", id, {
          ...(oldDoc || {}),
          id,
          ativo: false,
          updatedAt: nowIso,
        });

        // Create new record for the new resident
        const newId = crypto.randomUUID();
        const newRecord = {
          id: newId,
          nome: nomeTrimmed,
          apartamento: aptoTrimmed,
          telefone: telefoneTrimmed,
          email: emailTrimmed,
          saldo_devedor_inicial: saldoNum,
          ativo: true,
          condominioId,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await setDocument("proprietarios", newId, newRecord);
        updatedProprietario = newRecord;
      } else {
        // Regular update of existing record
        const oldDoc = await getDocument<any>("proprietarios", id);
        const record = {
          ...(oldDoc || {}),
          id,
          nome: nomeTrimmed,
          apartamento: aptoTrimmed,
          telefone: telefoneTrimmed,
          email: emailTrimmed,
          saldo_devedor_inicial: saldoNum,
          ativo: true,
          condominioId: oldDoc?.condominioId || condominioId,
          updatedAt: nowIso,
        };
        await setDocument("proprietarios", id, record);
        updatedProprietario = record;
      }
    } catch (fsErr: any) {
      console.error("Firestore save proprietario error:", fsErr);
    }

    // 3. Best-effort sync to Prisma
    try {
      if (data.mudancaProprietario) {
        await prisma.proprietario.update({
          where: { id, ...(condominioId ? { condominioId } : {}) },
          data: { ativo: false },
        });
        const pCreate = await prisma.proprietario.create({
          data: {
            nome: nomeTrimmed,
            apartamento: aptoTrimmed,
            telefone: telefoneTrimmed,
            email: emailTrimmed,
            saldo_devedor_inicial: saldoNum,
            ativo: true,
            condominioId,
          },
        });
        if (!updatedProprietario) updatedProprietario = pCreate;
      } else {
        const pUpdate = await prisma.proprietario.update({
          where: { id, ...(condominioId ? { condominioId } : {}) },
          data: {
            nome: nomeTrimmed,
            apartamento: aptoTrimmed,
            telefone: telefoneTrimmed,
            email: emailTrimmed,
            saldo_devedor_inicial: saldoNum,
          },
        });
        if (!updatedProprietario) updatedProprietario = pUpdate;
      }
    } catch (prismaErr: any) {
      console.warn("Prisma sync skipped/error:", prismaErr?.message);
    }

    if (!updatedProprietario) {
      updatedProprietario = {
        id,
        nome: nomeTrimmed,
        apartamento: aptoTrimmed,
        telefone: telefoneTrimmed,
        email: emailTrimmed,
        saldo_devedor_inicial: saldoNum,
        ativo: true,
        condominioId,
      };
    }

    return NextResponse.json(updatedProprietario);
  } catch (error) {
    console.error("Error updating proprietario:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao atualizar proprietário" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const condominioId = session.user.condominioId;

    // 1. Delete in Firestore
    try {
      const { deleteDocument } = await import("@/lib/firestore-service");
      await deleteDocument("proprietarios", id);
    } catch (fsErr: any) {
      console.warn("Firestore delete error:", fsErr?.message);
    }

    // 2. Best-effort sync to Prisma
    try {
      await prisma.proprietario.delete({
        where: { id, ...(condominioId ? { condominioId } : {}) },
      });
    } catch (prismaErr: any) {
      console.warn("Prisma delete skipped:", prismaErr?.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting proprietario:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao excluir proprietário" },
      { status: 500 },
    );
  }
}
