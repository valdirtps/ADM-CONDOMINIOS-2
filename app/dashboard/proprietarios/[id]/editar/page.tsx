import { ProprietarioForm } from '../../novo/proprietario-form';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EditarProprietarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;

  let proprietario: any = null;

  // 1. Try Firebase Firestore
  try {
    const { getDocument } = await import('@/lib/firestore-service');
    proprietario = await getDocument<any>('proprietarios', id);
    if (proprietario && session.user.condominioId && proprietario.condominioId && proprietario.condominioId !== session.user.condominioId) {
      proprietario = null;
    }
  } catch (err: any) {
    console.warn('Firestore lookup error for proprietario:', err?.message);
  }

  // 2. Fallback to Prisma
  if (!proprietario) {
    try {
      proprietario = await prisma.proprietario.findUnique({
        where: { id, ...(session.user.condominioId ? { condominioId: session.user.condominioId } : {}) },
      });
    } catch (prismaErr: any) {
      console.warn('Prisma lookup error for proprietario:', prismaErr?.message);
    }
  }

  if (!proprietario) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Editar Proprietário</h1>
      <ProprietarioForm initialData={proprietario} />
    </div>
  );
}
