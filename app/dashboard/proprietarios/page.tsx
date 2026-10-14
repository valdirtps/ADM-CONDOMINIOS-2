import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default async function ProprietariosPage() {
  const session = await getSession();
  if (!session) return null;

  let proprietarios: any[] = [];

  // 1. Try Firebase Firestore
  try {
    const { listDocuments } = await import('@/lib/firestore-service');
    const docs = await listDocuments<any>('proprietarios');
    if (docs && docs.length > 0) {
      proprietarios = docs.filter(p => (!session.user.condominioId || p.condominioId === session.user.condominioId) && p.ativo !== false);
    }
  } catch {}

  // 2. Fallback to Prisma
  if (proprietarios.length === 0) {
    try {
      proprietarios = await prisma.proprietario.findMany({
        where: { condominioId: session.user.condominioId, ativo: true },
        orderBy: { apartamento: 'asc' },
      });
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Proprietários</h1>
        <Button render={<Link href="/dashboard/proprietarios/novo" />}>
          <Plus className="mr-2 h-4 w-4" /> Adicionar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Proprietários</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apto</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proprietarios.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.apartamento}</TableCell>
                  <TableCell>{p.nome}</TableCell>
                  <TableCell>{p.telefone || '-'}</TableCell>
                  <TableCell>{p.email || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" render={<Link href={`/dashboard/proprietarios/${p.id}/editar`} />}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {proprietarios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum proprietário cadastrado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
