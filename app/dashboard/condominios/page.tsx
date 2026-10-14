import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function CondominiosPage() {
  const session = await getSession();
  if (!session || session.user.role !== 'ADMIN_SISTEMA') {
    redirect('/dashboard');
  }

  let condominios: any[] = [];

  // 1. Try Firebase Firestore
  try {
    const { listDocuments } = await import('@/lib/firestore-service');
    const docs = await listDocuments<any>('condominios');
    if (docs && docs.length > 0) {
      condominios = docs.map(d => ({
        ...d,
        usuarios: Array.isArray(d.usuarios) ? d.usuarios : [],
      }));
    }
  } catch {}

  // 2. If Firestore is empty, fallback to Prisma
  if (condominios.length === 0) {
    try {
      condominios = await prisma.condominio.findMany({
        include: {
          usuarios: {
            where: { role: 'ADMIN_CONDOMINIO' },
            take: 1,
          },
        },
        orderBy: { nome: 'asc' },
      });
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Condomínios</h1>
        <Button render={<Link href="/dashboard/condominios/novo" />}>
          <Plus className="mr-2 h-4 w-4" /> Adicionar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Condomínios</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Email Admin</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {condominios.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.cnpj || '-'}</TableCell>
                  <TableCell>{c.usuarios?.[0]?.nome || c.adminNome || '-'}</TableCell>
                  <TableCell>{c.usuarios?.[0]?.email || c.adminEmail || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" render={<Link href={`/dashboard/condominios/${c.id}/editar`} />}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {condominios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Nenhum condomínio cadastrado ainda. Use o botão <strong>&quot;Adicionar&quot;</strong> acima ou importe seus dados na tela de <strong>&quot;Migração Firebase&quot;</strong>.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
