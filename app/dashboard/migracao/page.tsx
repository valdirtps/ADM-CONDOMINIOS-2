import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MigracaoClient } from './migracao-client';

export const dynamic = 'force-dynamic';

export default async function MigracaoPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="max-w-5xl mx-auto py-2">
      <MigracaoClient />
    </div>
  );
}
