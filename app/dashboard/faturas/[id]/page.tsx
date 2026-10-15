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
    const { getDocument, listDocuments } = await import('@/lib/firestore-service');
    fatura = await getDocument<any>('faturas', id);
    if (fatura) {
      if (fatura.proprietarioId && !fatura.proprietario) {
        fatura.proprietario = (await getDocument<any>('proprietarios', fatura.proprietarioId)) || {
          nome: 'Proprietário',
          apartamento: '-',
          email: '',
          telefone: '',
        };
      }
      if (fatura.condominioId && !fatura.condominio) {
        fatura.condominio = (await getDocument<any>('condominios', fatura.condominioId)) || {
          nome: 'Condomínio',
          sindicos: [],
        };
      }

      // Populate sindicos if missing or empty
      if (fatura.condominio) {
        if (!Array.isArray(fatura.condominio.sindicos) || fatura.condominio.sindicos.length === 0) {
          const allSindicos = await listDocuments<any>('sindicos');
          const condoId = fatura.condominioId || session.user.condominioId;
          const activeSindico = (allSindicos || []).find(
            s => (!condoId || s.condominioId === condoId) && s.ativo
          );
          if (activeSindico) {
            if (activeSindico.proprietarioId && !activeSindico.proprietario) {
              activeSindico.proprietario = await getDocument<any>('proprietarios', activeSindico.proprietarioId);
            }
            fatura.condominio.sindicos = [activeSindico];
          } else {
            fatura.condominio.sindicos = [];
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('Firestore lookup warning in FaturaPage:', err?.message);
  }

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

  if (!fatura.proprietario) {
    fatura.proprietario = {
      nome: 'Proprietário',
      apartamento: '-',
      email: '',
      telefone: '',
    };
  }

  if (!fatura.condominio) {
    fatura.condominio = {
      nome: 'Condomínio',
      sindicos: [],
    };
  } else if (!Array.isArray(fatura.condominio.sindicos)) {
    fatura.condominio.sindicos = [];
  }

  return <FaturaView fatura={fatura} />;
}
