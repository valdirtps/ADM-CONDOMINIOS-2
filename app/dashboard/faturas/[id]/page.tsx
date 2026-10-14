import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import { FaturaView } from './fatura-view';

export const dynamic = 'force-dynamic';

export default async function FaturaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;

  let fatura: any = null;

  // 1. Try Firebase Firestore
  try {
    const { getDocument } = await import('@/lib/firestore-service');
    fatura = await getDocument<any>('faturas', id);
    if (fatura) {
      if (fatura.proprietarioId && !fatura.proprietario) {
        fatura.proprietario = await getDocument<any>('proprietarios', fatura.proprietarioId) || {
          nome: 'Proprietário',
          apartamento: '-',
          email: '',
          telefone: '',
        };
      }
      if (fatura.condominioId && !fatura.condominio) {
        fatura.condominio = await getDocument<any>('condominios', fatura.condominioId) || {
          nome: 'Condomínio',
          sindicos: [],
        };
      }
    }
  } catch {}

  // 2. Fallback to Prisma
  if (!fatura) {
    try {
      fatura = await prisma.fatura.findUnique({
        where: { id, condominioId: session.user.condominioId || undefined },
        include: {
          proprietario: true,
          condominio: {
            include: {
              sindicos: { where: { ativo: true }, include: { proprietario: true } }
            }
          }
        }
      });
    } catch {}
  }

  if (!fatura) notFound();

  return <FaturaView fatura={fatura} />;
}
