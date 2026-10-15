import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import { PagarFaturaForm } from './pagar-fatura-form';

export const dynamic = 'force-dynamic';

export default async function PagarFaturaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;

  let fatura: any = null;

  // 1. Try Firebase Firestore
  try {
    const { getDocument } = await import('@/lib/firestore-service');
    fatura = await getDocument<any>('faturas', id);
    if (fatura && fatura.proprietarioId && !fatura.proprietario) {
      fatura.proprietario = await getDocument<any>('proprietarios', fatura.proprietarioId);
    }
  } catch (err: any) {
    console.warn('Firestore lookup warning in PagarFaturaPage:', err?.message);
  }

  // 2. Fallback to Prisma
  if (!fatura) {
    try {
      fatura = await prisma.fatura.findUnique({
        where: { id, condominioId: session.user.condominioId || undefined },
        include: { proprietario: true },
      });
    } catch {}
  }

  if (!fatura) notFound();

  if (!fatura.proprietario) {
    fatura.proprietario = {
      nome: 'Proprietário',
      apartamento: '-',
    };
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Registrar Pagamento</h1>
      <PagarFaturaForm fatura={fatura} />
    </div>
  );
}
