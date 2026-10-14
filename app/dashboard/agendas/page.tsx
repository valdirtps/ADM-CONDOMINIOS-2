import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { AgendasClient } from "./agendas-client";

export default async function AgendasPage() {
  const session = await getSession();

  if (!session || (!session.user.condominioId && session.user.role !== "ADMIN_SISTEMA")) {
    redirect("/login");
  }

  let agendas: any[] = [];

  // 1. Try Firebase Firestore
  try {
    const { listDocuments } = await import('@/lib/firestore-service');
    const docs = await listDocuments<any>('agendasServico');
    if (docs && docs.length > 0) {
      agendas = docs.filter(a => !session.user.condominioId || a.condominioId === session.user.condominioId);
    }
  } catch {}

  // 2. Fallback to Prisma
  if (agendas.length === 0) {
    try {
      agendas = await prisma.agendaServico.findMany({
        where: {
          condominioId: session.user.condominioId || undefined,
        },
        orderBy: {
          data_agendamento: "desc",
        },
      });
    } catch {}
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Agenda de Serviços</h2>
      </div>
      <AgendasClient data={agendas} condominioId={session.user.condominioId || ""} />
    </div>
  );
}
