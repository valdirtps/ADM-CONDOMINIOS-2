import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { SindicoManager } from './sindico-manager';

export default async function SindicoPage() {
  const session = await getSession();
  if (!session) return null;

  let sindicos: any[] = [];
  let proprietarios: any[] = [];

  // 1. Try Firebase Firestore
  try {
    const { listDocuments } = await import('@/lib/firestore-service');
    const sDocs = await listDocuments<any>('sindicos');
    const pDocs = await listDocuments<any>('proprietarios');
    if (sDocs) sindicos = sDocs.filter(s => !session.user.condominioId || s.condominioId === session.user.condominioId);
    if (pDocs) proprietarios = pDocs.filter(p => (!session.user.condominioId || p.condominioId === session.user.condominioId) && p.ativo !== false);
  } catch {}

  // 2. Fallback to Prisma
  if (sindicos.length === 0 && proprietarios.length === 0) {
    try {
      sindicos = await prisma.sindico.findMany({
        where: { condominioId: session.user.condominioId },
        include: { proprietario: true },
        orderBy: { data_inicio: 'desc' },
      });

      proprietarios = await prisma.proprietario.findMany({
        where: { condominioId: session.user.condominioId, ativo: true },
        orderBy: { apartamento: 'asc' },
      });
    } catch {}
  }

  return (
    <div className="max-w-5xl mx-auto">
      <SindicoManager sindicos={sindicos} proprietarios={proprietarios} />
    </div>
  );
}
