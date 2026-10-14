import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { redirect } from 'next/navigation';

import { Suspense } from 'react';
import { BalanceteGenerator } from './balancete-generator';
import DashboardAlerts from '@/components/DashboardAlerts';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const { user } = session;

  if (!user.condominioId) {
    if (user.role === 'ADMIN_SISTEMA') {
      redirect('/dashboard/condominios');
    }
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Bem-vindo, {user.nome}</h1>
        <p>Você não possui um condomínio vinculado.</p>
      </div>
    );
  }

  // Perform maintenance tasks (non-blocking if possible, but here it's simple)
  try {
    const now = new Date();
    const todayMidnightUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    
    await prisma.sindico.updateMany({
      where: {
        condominioId: user.condominioId,
        ativo: true,
        data_fim: { lt: todayMidnightUTC }
      },
      data: { ativo: false }
    });
  } catch {}

  let condominio: any = null;

  // 1. Try Firebase Firestore
  try {
    const { getDocument, listDocuments } = await import('@/lib/firestore-service');
    condominio = await getDocument<any>('condominios', user.condominioId);
    if (condominio) {
      const [dDocs, crDocs, fDocs, pDocs] = await Promise.all([
        listDocuments<any>('despesas'),
        listDocuments<any>('creditosExtras'),
        listDocuments<any>('faturas'),
        listDocuments<any>('parametros'),
      ]);
      condominio.despesas = (dDocs || []).filter(d => d.condominioId === user.condominioId);
      condominio.creditosExtras = (crDocs || []).filter(c => c.condominioId === user.condominioId);
      condominio.faturas = (fDocs || []).filter(f => f.condominioId === user.condominioId);
      condominio.parametros = (pDocs || [])
        .filter(p => p.condominioId === user.condominioId)
        .sort((a, b) => (b.mes_ano || '').localeCompare(a.mes_ano || ''));
    }
  } catch {}

  // 2. Fallback to Prisma
  if (!condominio) {
    try {
      condominio = await prisma.condominio.findUnique({
        where: { id: user.condominioId },
        include: {
          despesas: true,
          creditosExtras: true,
          faturas: true,
          parametros: { orderBy: { mes_ano: 'desc' } }
        }
      });
    } catch {}
  }

  if (!condominio) {
    return <div>Condomínio não encontrado.</div>;
  }

  const toValidDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
    if (typeof val === 'object' && typeof val.toDate === 'function') {
      try { return val.toDate(); } catch { return new Date(); }
    }
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const getVencimentoForCycle = (referente: string | null, data_pagamento: any) => {
    let dataCalc = toValidDate(data_pagamento);
    if (referente && referente.match(/^\d{4}-\d{2}$/)) {
      const [y, m] = referente.split('-').map(Number);
      dataCalc = new Date(Date.UTC(y, m - 1, 15, 12, 0, 0));
    }
    
    let nextMonth = dataCalc.getUTCMonth(); 
    let nextYear = dataCalc.getUTCFullYear();
    
    const mesAnoStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;
    const param = (condominio.parametros || []).find((p: any) => p.mes_ano <= mesAnoStr) || condominio.parametros?.[0];
    const diaVencimento = param ? Number(param.dia_vencimento) || 10 : 10;

    return new Date(Date.UTC(nextYear, nextMonth, diaVencimento, 12, 0, 0));
  };

  const earliestParametro = (condominio.parametros || []).length > 0
    ? (condominio.parametros || []).reduce((min: string, p: any) => (p.mes_ano || '') < min ? (p.mes_ano || '') : min, '9999-99')
    : '0000-00';

  // Calculate cash flow
  const allTransactions = [
    ...(condominio.despesas || [])
      .filter((d: any) => (d.referente || '') >= earliestParametro)
      .map((d: any) => ({
        data: getVencimentoForCycle(d.referente, d.data_pagamento),
        entrada: 0,
        saida: Number(d.valor) || 0,
      })),
    ...(condominio.creditosExtras || [])
      .filter((c: any) => ((c.mes_ano || c.referente) || '') >= earliestParametro)
      .map((c: any) => ({
        data: c.data_vencimento ? toValidDate(c.data_vencimento) : getVencimentoForCycle(c.mes_ano || c.referente, c.data_pagamento || c.data_lancamento),
        entrada: Number(c.valor) || 0,
        saida: 0,
      })),
    ...(condominio.faturas || [])
      .filter((f: any) => f.status === 'PAGO' || f.status === 'PARCIAL')
      .map((f: any) => ({
        data: toValidDate(f.data_vencimento),
        entrada: Number(f.valor_pago || f.valor_total) || 0,
        saida: 0,
      })),
  ].sort((a, b) => toValidDate(a.data).getTime() - toValidDate(b.data).getTime());

  // Group by date
  const groupedByDate: Record<string, { data: Date; entradas: number; saidas: number }> = {};
  
  for (const t of allTransactions) {
    const validDate = toValidDate(t.data);
    const dateStr = format(validDate, 'yyyy-MM-dd');
    if (!groupedByDate[dateStr]) {
      groupedByDate[dateStr] = {
        data: validDate,
        entradas: 0,
        saidas: 0,
      };
    }
    groupedByDate[dateStr].entradas += t.entrada;
    groupedByDate[dateStr].saidas += t.saida;
  }

  const sortedDates = Object.keys(groupedByDate).sort();

  let saldoAtual = Number(condominio.saldo_inicial) || 0;
  const transacoesResumo = [];

  for (const dateStr of sortedDates) {
    const group = groupedByDate[dateStr];
    const saldoInicialDia = saldoAtual;
    const entradas = Number(group.entradas.toFixed(2));
    const saidas = Number(group.saidas.toFixed(2));
    saldoAtual = Number((saldoAtual + entradas - saidas).toFixed(2));
    
    transacoesResumo.push({
      data: group.data,
      saldoInicialDia,
      entradas,
      saidas,
      saldoFinal: saldoAtual,
    });
  }

  transacoesResumo.reverse(); // show newest first

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Fluxo de Caixa</h1>
      
      <Suspense fallback={<div className="h-16 w-full bg-slate-100 animate-pulse rounded-xl mb-6" />}>
        <DashboardAlerts condominioId={condominio.id} />
      </Suspense>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoAtual)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Extrato</CardTitle>
          <BalanceteGenerator />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Saldo Inicial</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Saldo Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transacoesResumo.map((t, i) => (
                <TableRow key={i}>
                  <TableCell>{format(t.data, 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.saldoInicialDia)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {t.entradas > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.entradas) : '-'}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {t.saidas > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.saidas) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.saldoFinal)}
                  </TableCell>
                </TableRow>
              ))}
              {transacoesResumo.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma transação encontrada.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
