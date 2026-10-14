import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Calculator, ArrowDown, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { GerarFaturasDialog } from './gerar-faturas-dialog';
import { SendEmailButton } from './send-email-button';
import { SendWhatsappButton } from './send-whatsapp-button';
import { ReopenFaturaButton } from './reopen-fatura-button';
import { SendBulkEmailsDialog } from './send-bulk-emails-dialog';
import { FaturasFilter } from './faturas-filter';
import { getSmtpConfig } from '@/lib/smtp-config';
import Link from 'next/link';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function FaturasPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) return null;

  const { vencimento } = await searchParams;
  const vencimentoStr = typeof vencimento === 'string' ? vencimento : undefined;

  let whereClause: any = { condominioId: session.user.condominioId };

  if (vencimentoStr) {
    const startDate = new Date(vencimentoStr + 'T00:00:00Z');
    const endDate = new Date(vencimentoStr + 'T23:59:59Z');
    whereClause.data_vencimento = {
      gte: startDate,
      lte: endDate,
    };
  }

  let faturas: any[] = [];

  // 1. Try Firebase Firestore
  try {
    const { listDocuments } = await import('@/lib/firestore-service');
    const [docs, pDocs] = await Promise.all([
      listDocuments<any>('faturas'),
      listDocuments<any>('proprietarios'),
    ]);

    if (docs && docs.length > 0) {
      const propMap = new Map((pDocs || []).map(p => [p.id, p]));
      faturas = docs
        .filter(f => !session.user.condominioId || f.condominioId === session.user.condominioId)
        .map(f => ({
          ...f,
          proprietario: f.proprietario || propMap.get(f.proprietarioId) || { apartamento: '-', nome: 'Proprietário', email: '', telefone: '' },
        }));

      if (vencimentoStr) {
        faturas = faturas.filter(f => {
          if (!f.data_vencimento) return false;
          const dStr = typeof f.data_vencimento === 'string'
            ? f.data_vencimento.slice(0, 10)
            : new Date(f.data_vencimento).toISOString().slice(0, 10);
          return dStr === vencimentoStr;
        });
      }
    }
  } catch {}

  // 2. Fallback to Prisma
  if (faturas.length === 0) {
    try {
      faturas = await prisma.fatura.findMany({
        where: whereClause,
        include: { proprietario: true, condominio: true },
        orderBy: [{ data_vencimento: 'desc' }, { proprietario: { apartamento: 'asc' } }],
      });
    } catch {}
  }

  // Classificar as faturas da data de vencimento mais atual para a mais antiga (descendente)
  faturas.sort((a, b) => {
    const timeA = a.data_vencimento ? new Date(a.data_vencimento).getTime() : 0;
    const timeB = b.data_vencimento ? new Date(b.data_vencimento).getTime() : 0;
    if (timeB !== timeA) {
      return timeB - timeA; // Mais atual primeiro
    }
    const aptoA = a.proprietario?.apartamento || '';
    const aptoB = b.proprietario?.apartamento || '';
    return aptoA.localeCompare(aptoB, undefined, { numeric: true });
  });

  const formatDateSafe = (dateVal: any) => {
    if (!dateVal) return '-';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '-';
      return format(new Date(d.getTime() + new Date().getTimezoneOffset() * 60000), 'dd/MM/yyyy');
    } catch {
      return '-';
    }
  };

  // Extract unique mes_ano strings for the bulk email dropdown
  const uniqueMesAno = Array.from(new Set(faturas.map(f => f.mes_ano)));

  const totalGeral = faturas.reduce((acc, f) => acc + f.valor_total, 0);
  const totalPago = faturas.reduce((acc, f) => acc + (f.valor_pago || 0), 0);
  const totalPendente = totalGeral - totalPago;

  const smtpConfig = await getSmtpConfig(session.user.condominioId);
  const isSmtpConfigured = !!(smtpConfig && smtpConfig.host && smtpConfig.user && smtpConfig.pass);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Faturas</h1>
        <div className="flex space-x-3">
          <SendBulkEmailsDialog meses={uniqueMesAno} />
          <GerarFaturasDialog />
        </div>
      </div>

      {!isSmtpConfigured && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Atenção:</strong> O servidor de envio de e-mail (SMTP) ainda não foi configurado. O envio de faturas (individual ou em lote) está em <strong>Modo Simulação</strong>.
            </span>
          </div>
          <Link 
            href="/dashboard/configuracoes" 
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:text-amber-950 underline flex-shrink-0"
          >
            Configurar E-mail (SMTP) &rarr;
          </Link>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-4">
        <div className="md:col-span-3">
          <FaturasFilter />
        </div>
        {vencimentoStr && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Resumo do Filtro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Esperado:</span>
                  <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGeral)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-primary">
                  <span>Total Recebido:</span>
                  <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPago)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground border-t pt-1 mt-1">
                  <span>A Receber:</span>
                  <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendente)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Faturas {vencimentoStr && `- Vencimento ${format(new Date(vencimentoStr + 'T12:00:00Z'), 'dd/MM/yyyy')}`}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês/Ano</TableHead>
                <TableHead>Apto</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>
                  <span className="flex items-center gap-1 font-bold text-foreground">
                    Vencimento <ArrowDown className="h-3.5 w-3.5 text-primary inline" />
                  </span>
                </TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Multa (Mês Anterior)</TableHead>
                <TableHead className="text-right">Acréscimo no Pgto</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faturas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.mes_ano}</TableCell>
                  <TableCell>{f.proprietario?.apartamento || '-'}</TableCell>
                  <TableCell>{f.proprietario?.nome || 'Proprietário'}</TableCell>
                  <TableCell>{formatDateSafe(f.data_vencimento)}</TableCell>
                  <TableCell>{formatDateSafe(f.data_pagamento)}</TableCell>
                  <TableCell className="text-right">
                    {(() => {
                      try {
                        const detalhes = typeof f.detalhes === 'string' ? JSON.parse(f.detalhes || '{"itens":[]}') : (f.detalhes || { itens: [] });
                        const multaAnterior = detalhes.itens
                          ?.filter((i: any) => i.descricao?.toLowerCase().includes('multa') || i.descricao?.toLowerCase().includes('juros'))
                          .reduce((acc: number, item: any) => acc + (Number(item.valor) || 0), 0) || 0;
                        return multaAnterior > 0 
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(multaAnterior)
                          : '-';
                      } catch {
                        return '-';
                      }
                    })()}
                  </TableCell>
                  <TableCell className="text-right">
                    {((Number(f.multa) || 0) + (Number(f.juros) || 0)) > 0 
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(f.multa) || 0) + (Number(f.juros) || 0))
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(f.valor_total) || 0)}</TableCell>
                  <TableCell>
                    <Badge variant={f.status === 'PAGO' ? 'default' : f.status === 'ATRASADO' ? 'destructive' : 'secondary'}>
                      {f.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    {f.status !== 'PAGO' ? (
                      <Button variant="default" size="sm" render={<Link href={`/dashboard/faturas/${f.id}/pagar`} />}>
                        Pagar
                      </Button>
                    ) : (
                      <ReopenFaturaButton faturaId={f.id} />
                    )}
                    <Button variant="outline" size="sm" render={<Link href={`/dashboard/faturas/${f.id}`} />}>
                      PDF
                    </Button>
                    <SendEmailButton faturaId={f.id} email={f.proprietario?.email || ''} />
                    <SendWhatsappButton faturaId={f.id} telefone={f.proprietario?.telefone || ''} mesAno={f.mes_ano} apartamento={f.proprietario?.apartamento || ''} />
                  </TableCell>
                </TableRow>
              ))}
              {faturas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-4">Nenhuma fatura gerada.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
