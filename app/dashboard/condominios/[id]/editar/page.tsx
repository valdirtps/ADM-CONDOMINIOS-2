import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { redirect } from 'next/navigation';
import { EditCondominioForm } from './edit-form';

export const dynamic = 'force-dynamic';

export default async function EditarCondominioPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.user.role !== 'ADMIN_SISTEMA') {
    redirect('/dashboard');
  }

  const { id } = await params;

  let condominio: any = null;

  // 1. Try Firebase Firestore
  try {
    const { getDocument } = await import('@/lib/firestore-service');
    condominio = await getDocument<any>('condominios', id);
  } catch {}

  // 2. Fallback to Prisma
  if (!condominio) {
    try {
      condominio = await prisma.condominio.findUnique({
        where: { id },
        include: {
          usuarios: {
            where: { role: 'ADMIN_CONDOMINIO' },
            take: 1,
          },
        },
      });
    } catch (err: any) {
      console.warn('Prisma condominio lookup bypassed:', err.message);
    }
  }

  if (!condominio) {
    redirect('/dashboard/condominios');
  }

  return <EditCondominioForm condominio={condominio} />;
}
