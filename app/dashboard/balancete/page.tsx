import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { BalancetePrintButton } from './print-button';
import Link from 'next/link';
import { getActiveChamadasExtras } from '@/lib/chamadas-extras';

export default async function BalancetePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const session = await getSession();
  if (!session || !session.user.condominioId) {
    redirect('/login');
  }

  const sp = await searchParams;
  const mesAno = typeof sp.mes_ano === 'string' ? sp.mes_ano : undefined;
  
  if (!mesAno) {
    return <div>Mês/Ano não informado. <Link href="/dashboard" className="text-blue-600 underline">Voltar</Link></div>;
  }

  const [year, month] = mesAno.split('-');

  let condominio: any = null;

  // 1. Try Firebase Firestore
  try {
    const { getDocument, listDocuments } = await import('@/lib/firestore-service');
    const condoDoc = await getDocument<any>('condominios', session.user.condominioId);
    if (condoDoc) {
      const [despesas, creditosExtras, chamadasExtras, sindicos, faturas, parametros, proprietarios] = await Promise.all([
        listDocuments<any>('despesas'),
        listDocuments<any>('creditosExtras'),
        listDocuments<any>('chamadasExtras'),
        listDocuments<any>('sindicos'),
        listDocuments<any>('faturas'),
        listDocuments<any>('parametros'),
        listDocuments<any>('proprietarios'),
      ]);

      const propMap = new Map((proprietarios || []).map(p => [p.id, p]));
      const condoId = session.user.condominioId;

      condominio = {
        ...condoDoc,
        despesas: (despesas || []).filter(d => !d.condominioId || d.condominioId === condoId),
        creditosExtras: (creditosExtras || []).filter(c => !c.condominioId || c.condominioId === condoId),
        chamadasExtras: (chamadasExtras || []).filter(ce => !ce.condominioId || ce.condominioId === condoId),
        sindicos: (sindicos || [])
          .filter(s => (!s.condominioId || s.condominioId === condoId) && s.ativo !== false)
          .map(s => ({
            ...s,
            proprietario: s.proprietario || propMap.get(s.proprietarioId) || null,
          })),
        faturas: (faturas || [])
          .filter(f => !f.condominioId || f.condominioId === condoId)
          .map(f => ({
            ...f,
            proprietario: f.proprietario || propMap.get(f.proprietarioId) || { apartamento: '-', nome: 'Proprietário' },
          })),
        parametros: (parametros || [])
          .filter(p => !p.condominioId || p.condominioId === condoId)
          .sort((a, b) => (b.mes_ano || '').localeCompare(a.mes_ano || '')),
      };
    }
  } catch (fbErr: any) {
    console.warn('Firestore lookup error in balancete page:', fbErr?.message);
  }

  // 2. Fallback to Prisma
  if (!condominio) {
    try {
      condominio = await prisma.condominio.findUnique({
        where: { id: session.user.condominioId },
        include: {
          despesas: true,
          creditosExtras: true,
          chamadasExtras: true,
          sindicos: {
            where: { ativo: true },
            include: { proprietario: true },
            orderBy: { data_inicio: 'desc' },
          },
          faturas: {
            include: { proprietario: true },
          },
          parametros: { orderBy: { mes_ano: 'desc' } },
        },
      });
    } catch (prismaErr: any) {
      console.warn('Prisma lookup error in balancete page:', prismaErr?.message);
    }
  }

  if (!condominio) return <div>Condomínio não encontrado.</div>;

  const activeSindico = condominio.sindicos.find(s => {
    if (!s.data_fim) return true;
    const today = new Date();
    today.setHours(0,0,0,0);
    const dataFim = new Date(s.data_fim);
    return dataFim >= today;
  }) || condominio.sindicos[0];

  const getVencimentoForCycle = (referente: string | null, data_pagamento: Date) => {
    let dataCalc = data_pagamento || new Date();
    if (referente && referente.match(/^\d{4}-\d{2}$/)) {
      const [y, m] = referente.split('-').map(Number);
      dataCalc = new Date(Date.UTC(y, m - 1, 15, 12, 0, 0));
    }
    
    let nextMonth = dataCalc.getUTCMonth(); 
    let nextYear = dataCalc.getUTCFullYear();
    
    const mesAnoStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;
    const param = condominio.parametros.find(p => p.mes_ano <= mesAnoStr) || condominio.parametros[0];
    const diaVencimento = param ? param.dia_vencimento : 10;

    return new Date(Date.UTC(nextYear, nextMonth, diaVencimento, 12, 0, 0));
  };

  const allTransactions = [
    ...condominio.despesas.map(d => ({
      type: 'despesa',
      data: getVencimentoForCycle(d.referente, d.data_pagamento),
      entrada: 0,
      saida: d.valor,
      desc: d.tipo, // Detalhamento da despesa
      raw: d
    })),
    ...condominio.creditosExtras.map(c => ({
      type: 'credito',
      data: c.data_vencimento || getVencimentoForCycle(c.mes_ano || c.referente, c.data_pagamento || c.data_lancamento),
      entrada: c.valor,
      saida: 0,
      desc: c.referente,
      raw: c
    })),
    ...condominio.faturas.filter(f => f.status === 'PAGO' || f.status === 'PARCIAL').map(f => ({
      type: 'fatura',
      data: f.data_vencimento, // use data de vencimento to align with competência
      entrada: f.valor_pago || f.valor_total,
      saida: 0,
      desc: `Apto ${f.proprietario?.apartamento || ''}`,
      raw: f
    })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime());

  let saldoInicial = condominio.saldo_inicial;
  let saldoAnterior = saldoInicial;

  let totalEntradas = 0;
  let totalSaidas = 0;

  const currentMonthTransactions = [];
  
  for (const t of allTransactions) {
    const tYear = t.data.getUTCFullYear();
    const tMonth = t.data.getUTCMonth() + 1;
    const tMesAno = `${tYear}-${String(tMonth).padStart(2, '0')}`;

    if (tMesAno < mesAno) {
      saldoAnterior += t.entrada - t.saida;
    } else if (tMesAno === mesAno) {
      currentMonthTransactions.push(t);
      totalEntradas += t.entrada;
      totalSaidas += t.saida;
    }
  }

  const saldoFinal = saldoAnterior + totalEntradas - totalSaidas;

  const despesasDoMes = currentMonthTransactions.filter(t => t.type === 'despesa');
  const faturasPagas = currentMonthTransactions.filter(t => t.type === 'fatura');
  const creditosExtras = currentMonthTransactions.filter(t => t.type === 'credito');

  // Multas a cobrar no proximo mes - find unpaid faturas or faturas paid late that have multas? 
  // User asked "multas a ser cobradas na proximo mes".
  // This is typically the overdue faturas from this month.
  // Next month is:
  let nextModMonth = parseInt(month) + 1;
  let nextModYear = parseInt(year);
  if (nextModMonth > 12) {
    nextModMonth = 1;
    nextModYear++;
  }
  const nextMesAno = `${nextModYear}-${String(nextModMonth).padStart(2, '0')}`;
  
  const faturasEmAtraso = condominio.faturas.filter(f => {
    if (f.status === 'PENDENTE' || f.status === 'ATRASADO') {
      const fYear = f.data_vencimento.getUTCFullYear();
      const fMonth = f.data_vencimento.getUTCMonth() + 1;
      const fMesAno = `${fYear}-${String(fMonth).padStart(2, '0')}`;
      return fMesAno === mesAno || fMesAno < mesAno;
    }
    return false;
  });

  const activeChamadasExtras = getActiveChamadasExtras(condominio.chamadasExtras, mesAno);

  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="bg-white text-black min-h-screen p-8 max-w-4xl mx-auto printable-area">
      <div className="flex justify-between items-center mb-8 no-print">
        <Link href="/dashboard" className="text-blue-600 hover:underline">← Voltar</Link>
        <BalancetePrintButton sindico={activeSindico} mesAno={mesAno} condominioNome={condominio.nome} condominioId={condominio.id} />
      </div>

      <div className="text-center mb-8 border-b pb-6 border-gray-300">
        <h1 className="text-3xl font-bold uppercase">{condominio.nome}</h1>
        <h2 className="text-xl mt-2 text-gray-700">Balancete Mensal - {month}/{year}</h2>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="border border-gray-300 rounded p-4">
          <h3 className="font-bold text-lg mb-4 text-center border-b pb-2">Resumo Financeiro</h3>
          <div className="flex justify-between mb-2">
            <span>Saldo Anterior:</span>
            <span className="font-medium">{currencyFormatter.format(saldoAnterior)}</span>
          </div>
          <div className="flex justify-between mb-2 text-green-700">
            <span>Entradas do Mês:</span>
            <span className="font-medium">+{currencyFormatter.format(totalEntradas)}</span>
          </div>
          <div className="flex justify-between mb-2 text-red-700">
            <span>Saídas do Mês:</span>
            <span className="font-medium">-{currencyFormatter.format(totalSaidas)}</span>
          </div>
          <div className="flex justify-between mt-4 pt-2 border-t border-gray-300 font-bold text-lg">
            <span>Saldo Atual:</span>
            <span>{currencyFormatter.format(saldoFinal)}</span>
          </div>
        </div>

        <div className="border border-gray-300 rounded p-4 bg-gray-50">
          <h3 className="font-bold text-lg mb-4 text-center border-b pb-2 border-gray-300">Inadimplência (A receber)</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
             {faturasEmAtraso.length === 0 ? (
               <p className="text-sm text-center text-gray-500">Nenhuma fatura em atraso.</p>
             ) : (
               faturasEmAtraso.map((f, i) => (
                 <div key={i} className="flex justify-between text-sm">
                   <span>Apto {f.proprietario?.apartamento} ({format(f.data_vencimento, 'dd/MM')})</span>
                   <span className="text-red-600 font-medium">{currencyFormatter.format(f.valor_total)}</span>
                 </div>
               ))
             )}
          </div>
        </div>
      </div>

      <div className="mb-8 border border-gray-300 rounded overflow-hidden">
        <h3 className="font-bold bg-gray-100 p-2 px-4 border-b border-gray-300 text-lg uppercase">Receitas (Entradas)</h3>
        <div className="p-4 space-y-4">
          {faturasPagas.length > 0 && (
            <div>
              <h4 className="font-bold mb-2">Pagamento de Faturas</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-left bg-gray-50">
                    <th className="py-1 px-2 font-semibold">Apto</th>
                    <th className="py-1 px-2 font-semibold text-center">Vencimento</th>
                    <th className="py-1 px-2 font-semibold text-center">Pagamento</th>
                    <th className="py-1 px-2 font-semibold text-right">Multa/Atraso</th>
                    <th className="py-1 px-2 font-semibold text-right">Valor Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {faturasPagas.map((f, i) => {
                    const raw = f.raw as any;
                    const multa = (raw.multa || 0) + (raw.juros || 0);
                    return (
                      <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="py-1 px-2">{f.desc}</td>
                        <td className="py-1 px-2 text-center text-gray-600">{format(raw.data_vencimento, 'dd/MM/yyyy')}</td>
                        <td className="py-1 px-2 text-center">{raw.data_pagamento ? format(raw.data_pagamento, 'dd/MM/yyyy') : '-'}</td>
                        <td className="py-1 px-2 text-right text-red-600">{multa > 0 ? currencyFormatter.format(multa) : '-'}</td>
                        <td className="py-1 px-2 text-right font-medium text-green-700">{currencyFormatter.format(f.entrada)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {creditosExtras.length > 0 && (
            <div>
              <h4 className="font-bold mb-2 mt-4">Outras Receitas e Créditos</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-left bg-gray-50">
                    <th className="py-1 px-2 font-semibold">Crédito/Receita</th>
                    <th className="py-1 px-2 font-semibold text-center">Data</th>
                    <th className="py-1 px-2 font-semibold text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {creditosExtras.map((c, i) => {
                    const raw = c.raw as any;
                    return (
                      <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="py-1 px-2">{c.desc}</td>
                        <td className="py-1 px-2 text-center text-gray-600">{raw.data_pagamento ? format(raw.data_pagamento, 'dd/MM/yyyy') : '-'}</td>
                        <td className="py-1 px-2 text-right font-medium text-green-700">{currencyFormatter.format(c.entrada)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {faturasPagas.length === 0 && creditosExtras.length === 0 && (
            <p className="text-gray-500 italic">Nenhuma receita registrada no mês.</p>
          )}

          {activeChamadasExtras.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="font-bold mb-2">Chamadas Extras Vinculadas (Detalhes)</h4>
              <p className="text-xs text-gray-500 mb-2">Estes valores já estão inclusos no pagamento das faturas acima.</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-left bg-gray-50">
                    <th className="py-1 px-2 font-semibold">Referente</th>
                    <th className="py-1 px-2 font-semibold text-center">Parcela</th>
                    <th className="py-1 px-2 font-semibold text-right">Valor Mensal</th>
                    <th className="py-1 px-2 font-semibold text-right">Valor Total da Chamada</th>
                  </tr>
                </thead>
                <tbody>
                  {activeChamadasExtras.map((ce, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="py-1 px-2">{ce.referente || 'Chamada Extra'}</td>
                      <td className="py-1 px-2 text-center text-gray-600">{ce.current_parcela} / {ce.parcelas}</td>
                      <td className="py-1 px-2 text-right font-medium text-gray-800">{currencyFormatter.format(ce.valor)}</td>
                      <td className="py-1 px-2 text-right text-gray-600">{ce.valor_total ? currencyFormatter.format(ce.valor_total) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="mb-8 border border-gray-300 rounded overflow-hidden">
        <h3 className="font-bold bg-gray-100 p-2 px-4 border-b border-gray-300 text-lg uppercase">Despesas (Saídas)</h3>
        <div className="p-4">
          {despesasDoMes.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-left bg-gray-50">
                  <th className="py-1 px-2 font-semibold">Despesa</th>
                  <th className="py-1 px-2 font-semibold">Detalhes</th>
                  <th className="py-1 px-2 font-semibold text-center">Data Pagamento</th>
                  <th className="py-1 px-2 font-semibold text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {despesasDoMes.map((d, i) => {
                  const raw = d.raw as any;
                  return (
                    <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="py-1 px-2">{d.desc}</td>
                      <td className="py-1 px-2 text-gray-600">{raw.observacao || '-'}</td>
                      <td className="py-1 px-2 text-center text-gray-600">{format(raw.data_pagamento, 'dd/MM/yyyy')}</td>
                      <td className="py-1 px-2 text-right font-medium text-red-700">{currencyFormatter.format(d.saida)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 italic">Nenhuma despesa registrada no mês.</p>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .printable-area { padding: 0 !important; max-width: 100% !important; border: none !important; box-shadow: none !important; }
          @page { margin: 2cm; }
        }
      `}} />
    </div>
  );
}
