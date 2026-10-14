import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getActiveChamadasExtras } from '@/lib/chamadas-extras';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { mes_ano, tipo_acao = 'gerar' } = await request.json();
    if (!mes_ano) return NextResponse.json({ error: 'Mês/Ano é obrigatório' }, { status: 400 });

    const condominioId = session.user.condominioId;

    // Check if invoices already generated
    const existingFaturas = await prisma.fatura.findMany({
      where: { mes_ano, condominioId },
      select: { id: true, status: true, proprietarioId: true }
    });

    if (existingFaturas.length > 0 && tipo_acao !== 'recalcular') {
      return NextResponse.json({ 
        error: 'Faturas já geradas para este mês',
        hasExisting: true
      }, { status: 400 });
    }

    if (tipo_acao === 'recalcular') {
      // Delete only pending invoices
      await prisma.fatura.deleteMany({
        where: { mes_ano, condominioId, status: 'PENDENTE' }
      });
    }

    // List of owners that already have a paid/overdue invoice (if recalculating, we don't recreate these)
    const ownersWithKeptInvoices = tipo_acao === 'recalcular' 
      ? existingFaturas.filter(f => f.status !== 'PENDENTE').map(f => f.proprietarioId)
      : [];

    // Get parameters (find the most recent one up to the requested mes_ano)
    const parametrosList = await prisma.parametros.findMany({
      where: { 
        condominioId,
        mes_ano: { lte: mes_ano }
      },
      orderBy: { mes_ano: 'desc' },
      take: 1
    });
    const parametros = parametrosList[0];
    if (!parametros) return NextResponse.json({ error: 'Parâmetros do condomínio não configurados para este período' }, { status: 400 });

    // Get monthly values
    const valoresMensais = await prisma.valoresMensais.findUnique({
      where: { mes_ano_condominioId: { mes_ano, condominioId } },
    });

    if (!valoresMensais) return NextResponse.json({ error: 'Valores mensais não lançados para este mês' }, { status: 400 });

    // Get active sindico
    const sindico = await prisma.sindico.findFirst({
      where: { condominioId, ativo: true },
    });

    // Get extra calls
    const chamadasExtras = await prisma.chamadaExtra.findMany({
      where: { mes_ano, condominioId },
    });

    const todasChamadasExtras = await prisma.chamadaExtra.findMany({
      where: { condominioId, mes_ano: { lte: mes_ano } },
    });

    // Get individual values
    const valoresIndividuais = await prisma.valoresIndividuais.findMany({
      where: { mes_ano, condominioId },
    });

    // Determine previous month for despesas
    const [yearStr, monthStr] = mes_ano.split('-');
    let pYear = parseInt(yearStr);
    let pMonth = parseInt(monthStr);
    pMonth -= 1;
    if (pMonth < 1) {
        pMonth = 12;
        pYear -= 1;
    }
    const prevMesAno = `${pYear}-${String(pMonth).padStart(2, '0')}`;

    // Get expenses from previous month
    const despesasMesAnterior = await prisma.despesa.findMany({
      where: {
        condominioId,
        referente: prevMesAno
      }
    });

    const totalDespesas = despesasMesAnterior.reduce((sum, d) => sum + d.valor, 0);
    const detalheDespesasObj = {
      mes_ano: prevMesAno,
      total: totalDespesas,
      itens: despesasMesAnterior.map(d => {
        let text = d.tipo;
        if (d.observacao) {
          text += ` - ${d.observacao}`;
        } else if (d.referente && !d.referente.match(/^\d{4}-\d{2}$/)) {
          text += ` - ${d.referente}`;
        }
        return {
          descricao: text,
          valor: d.valor,
          data_pagamento: d.data_pagamento.toISOString()
        };
      })
    };

    // Get all active owners
    const proprietarios = await prisma.proprietario.findMany({
      where: { condominioId, ativo: true },
    });

    if (proprietarios.length === 0) return NextResponse.json({ error: 'Nenhum proprietário cadastrado' }, { status: 400 });

    // Calculate rateio
    let aptosPagantes = proprietarios.length;
    let isDividirMenosUm = parametros.dividir_rateio_menos_um === true && proprietarios.length > 1;

    if (isDividirMenosUm) {
      aptosPagantes -= 1;
    } else if (sindico && sindico.proprietarioId && !sindico.paga_condominio) {
      aptosPagantes -= 1;
    }

    let aptosPagantesChamadaExtra = proprietarios.length;
    if (sindico && sindico.proprietarioId && !sindico.paga_chamada_extra) {
      aptosPagantesChamadaExtra -= 1;
    }

    const rateioAgua = valoresMensais.valor_agua / (aptosPagantes || 1);
    const rateioLuz = valoresMensais.valor_luz / (aptosPagantes || 1);

    let baseTaxaCondominio = valoresMensais.taxa_condominio;
    let baseFundoReserva = valoresMensais.fundo_reserva;

    // Calculate due date
    const [year, month] = mes_ano.split('-');
    // Use Date.UTC to prevent timezone offset issues causing the date to drift back one day
    const dueDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parametros.dia_vencimento, 12, 0, 0));

    const faturasToCreate = [];

    for (const prop of proprietarios) {
      if (ownersWithKeptInvoices.includes(prop.id)) {
        continue;
      }

      const isSindico = sindico?.proprietarioId === prop.id;
      let isentoCondominio = isSindico && !sindico.paga_condominio;
      const isentoChamadaExtra = isSindico && !sindico.paga_chamada_extra;

      if (isDividirMenosUm) {
        // As per the rule, we charge ALL 8 apartments the new higher rate!
        isentoCondominio = false; 
      }

      let total = 0;
      const detalhes: any = { 
        itens: [], 
        despesasAnteriores: detalheDespesasObj,
        observacaoGeral: valoresMensais.observacao || null
      };

      // Taxa Condominio
      if (!isentoCondominio) {
        total += baseTaxaCondominio;
        detalhes.itens.push({ descricao: 'Taxa de Condomínio', valor: baseTaxaCondominio });
      }

      // Fundo Reserva
      if (!isentoCondominio) {
        total += baseFundoReserva;
        detalhes.itens.push({ descricao: 'Fundo de Reserva', valor: baseFundoReserva });
      }

      // Rateio Agua
      if (!isentoCondominio) {
        total += rateioAgua;
        detalhes.itens.push({ descricao: 'Rateio de Água', valor: rateioAgua });
      }

      // Rateio Luz
      if (!isentoCondominio) {
        total += rateioLuz;
        detalhes.itens.push({ descricao: 'Rateio de Luz', valor: rateioLuz });
      }

      // Chamadas Extras
      if (!isentoChamadaExtra) {
        const activeCE = getActiveChamadasExtras(todasChamadasExtras, mes_ano);
        for (const ce of activeCE) {
          const rateioCE = ce.valor / (aptosPagantesChamadaExtra || 1);
          total += rateioCE;
          
          let descricao = 'Chamada Extra';
          if (ce.referente) {
             descricao = `Chamada Extra: ${ce.referente} - ${ce.current_parcela}/${ce.parcelas} parcelas`;
          }
          
          detalhes.itens.push({ descricao, valor: rateioCE });
        }
      }

      // Valores Individuais
      const indVals = valoresIndividuais.filter(v => v.proprietarioId === prop.id);
      for (const iv of indVals) {
        total += iv.valor;
        detalhes.itens.push({ descricao: `Valor Exclusivo: ${iv.descricao}`, valor: iv.valor });
      }

      // Saldo Devedor Anterior (if any)
      // Here we could check previous unpaid invoices and add them, but for now we just use the initial balance if it's the first invoice
      // Or we can just leave it as is and handle late invoices separately. Let's add initial balance if it's > 0 and no previous invoices exist.
      const previousInvoices = await prisma.fatura.count({ where: { proprietarioId: prop.id } });
      if (previousInvoices === 0 && prop.saldo_devedor_inicial > 0) {
        total += prop.saldo_devedor_inicial;
        detalhes.itens.push({ descricao: 'Saldo Devedor Inicial', valor: prop.saldo_devedor_inicial });
      }

      // Round total to 2 decimal places
      const valor_total = Math.round(total * 100) / 100;

      faturasToCreate.push({
        mes_ano,
        proprietarioId: prop.id,
        valor_total,
        data_vencimento: dueDate,
        status: 'PENDENTE',
        detalhes: JSON.stringify(detalhes),
        condominioId,
      });
    }

    await prisma.fatura.createMany({
      data: faturasToCreate,
    });

    return NextResponse.json({ success: true, count: faturasToCreate.length });
  } catch (error) {
    console.error('Error generating faturas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
