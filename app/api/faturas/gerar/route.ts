import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getActiveChamadasExtras } from '@/lib/chamadas-extras';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { mes_ano, tipo_acao = 'gerar' } = await request.json();
    if (!mes_ano) return NextResponse.json({ error: 'Mês/Ano é obrigatório' }, { status: 400 });

    const condominioId = session.user.condominioId;

    // 1. Fetch existing faturas
    let existingFaturas: any[] = [];
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const allFaturas = await listDocuments<any>('faturas');
      existingFaturas = (allFaturas || []).filter(
        f => f.mes_ano === mes_ano && (!condominioId || f.condominioId === condominioId)
      );
    } catch (fbErr: any) {
      console.warn('Firestore lookup warning in gerar faturas:', fbErr?.message);
    }

    if (existingFaturas.length === 0) {
      try {
        existingFaturas = await prisma.fatura.findMany({
          where: { mes_ano, condominioId: condominioId || undefined },
          select: { id: true, status: true, proprietarioId: true }
        });
      } catch (prismaErr: any) {
        console.warn('Prisma existing faturas query failed:', prismaErr?.message);
      }
    }

    if (existingFaturas.length > 0 && tipo_acao !== 'recalcular') {
      return NextResponse.json({ 
        error: 'Faturas já geradas para este mês',
        hasExisting: true
      }, { status: 400 });
    }

    if (tipo_acao === 'recalcular') {
      // Delete only pending invoices from Firestore
      try {
        const { listDocuments, deleteDocument } = await import('@/lib/firestore-service');
        const pendingToDelete = existingFaturas.filter(f => f.status === 'PENDENTE');
        for (const f of pendingToDelete) {
          await deleteDocument('faturas', f.id);
        }
      } catch (fbDelErr: any) {
        console.warn('Firestore delete pending faturas warning:', fbDelErr?.message);
      }

      // Also try to delete from Prisma
      try {
        await prisma.fatura.deleteMany({
          where: { mes_ano, condominioId: condominioId || undefined, status: 'PENDENTE' }
        });
      } catch (prismaDelErr: any) {
        console.warn('Prisma delete pending faturas skipped:', prismaDelErr?.message);
      }
    }

    // List of owners that already have a paid/overdue invoice (if recalculating, we don't recreate these)
    const ownersWithKeptInvoices = tipo_acao === 'recalcular' 
      ? existingFaturas.filter(f => f.status !== 'PENDENTE').map(f => f.proprietarioId)
      : [];

    // Load data from Firestore first
    let parametros: any = null;
    let valoresMensais: any = null;
    let sindico: any = null;
    let todasChamadasExtras: any[] = [];
    let valoresIndividuais: any[] = [];
    let despesasMesAnterior: any[] = [];
    let proprietarios: any[] = [];
    let previousInvoicesCountByProp = new Map<string, number>();

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

    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const [
        pList,
        vmList,
        sList,
        ceList,
        viList,
        dList,
        propList,
        allFaturasList
      ] = await Promise.all([
        listDocuments<any>('parametros'),
        listDocuments<any>('valoresMensais'),
        listDocuments<any>('sindicos'),
        listDocuments<any>('chamadasExtras'),
        listDocuments<any>('valoresIndividuais'),
        listDocuments<any>('despesas'),
        listDocuments<any>('proprietarios'),
        listDocuments<any>('faturas'),
      ]);

      const condoParams = (pList || [])
        .filter(p => (!condominioId || p.condominioId === condominioId) && p.mes_ano <= mes_ano)
        .sort((a, b) => b.mes_ano.localeCompare(a.mes_ano));
      parametros = condoParams[0] || null;

      valoresMensais = (vmList || []).find(
        v => (!condominioId || v.condominioId === condominioId) && v.mes_ano === mes_ano
      ) || null;

      sindico = (sList || []).find(
        s => (!condominioId || s.condominioId === condominioId) && s.ativo !== false
      ) || null;

      todasChamadasExtras = (ceList || []).filter(
        ce => (!condominioId || ce.condominioId === condominioId) && ce.mes_ano <= mes_ano
      );

      valoresIndividuais = (viList || []).filter(
        vi => (!condominioId || vi.condominioId === condominioId) && vi.mes_ano === mes_ano
      );

      despesasMesAnterior = (dList || []).filter(
        d => (!condominioId || d.condominioId === condominioId) && d.referente === prevMesAno
      );

      proprietarios = (propList || []).filter(
        pr => (!condominioId || pr.condominioId === condominioId) && pr.ativo !== false
      );

      for (const f of allFaturasList || []) {
        if (!condominioId || f.condominioId === condominioId) {
          const c = previousInvoicesCountByProp.get(f.proprietarioId) || 0;
          previousInvoicesCountByProp.set(f.proprietarioId, c + 1);
        }
      }
    } catch (fbLoadErr: any) {
      console.warn('Firestore load collections warning in gerar:', fbLoadErr?.message);
    }

    // Fallbacks to Prisma if Firestore didn't have something
    if (!parametros) {
      try {
        const parametrosList = await prisma.parametros.findMany({
          where: { 
            condominioId: condominioId || undefined,
            mes_ano: { lte: mes_ano }
          },
          orderBy: { mes_ano: 'desc' },
          take: 1
        });
        parametros = parametrosList[0];
      } catch {}
    }
    if (!parametros) return NextResponse.json({ error: 'Parâmetros do condomínio não configurados para este período' }, { status: 400 });

    if (!valoresMensais) {
      try {
        valoresMensais = await prisma.valoresMensais.findUnique({
          where: { mes_ano_condominioId: { mes_ano, condominioId: condominioId || '' } },
        });
      } catch {}
    }
    if (!valoresMensais) return NextResponse.json({ error: 'Valores mensais não lançados para este mês' }, { status: 400 });

    if (!sindico) {
      try {
        sindico = await prisma.sindico.findFirst({
          where: { condominioId: condominioId || undefined, ativo: true },
        });
      } catch {}
    }

    if (todasChamadasExtras.length === 0) {
      try {
        todasChamadasExtras = await prisma.chamadaExtra.findMany({
          where: { condominioId: condominioId || undefined, mes_ano: { lte: mes_ano } },
        });
      } catch {}
    }

    if (valoresIndividuais.length === 0) {
      try {
        valoresIndividuais = await prisma.valoresIndividuais.findMany({
          where: { mes_ano, condominioId: condominioId || undefined },
        });
      } catch {}
    }

    if (despesasMesAnterior.length === 0) {
      try {
        despesasMesAnterior = await prisma.despesa.findMany({
          where: {
            condominioId: condominioId || undefined,
            referente: prevMesAno
          }
        });
      } catch {}
    }

    if (proprietarios.length === 0) {
      try {
        proprietarios = await prisma.proprietario.findMany({
          where: { condominioId: condominioId || undefined, ativo: true },
        });
      } catch {}
    }

    if (proprietarios.length === 0) return NextResponse.json({ error: 'Nenhum proprietário cadastrado' }, { status: 400 });

    const totalDespesas = despesasMesAnterior.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
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
        let dPgtoIso = '';
        try {
          dPgtoIso = d.data_pagamento ? new Date(d.data_pagamento).toISOString() : new Date().toISOString();
        } catch {
          dPgtoIso = new Date().toISOString();
        }
        return {
          descricao: text,
          valor: Number(d.valor) || 0,
          data_pagamento: dPgtoIso
        };
      })
    };

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

    const valorAgua = Number(valoresMensais.valor_agua) || 0;
    const valorLuz = Number(valoresMensais.valor_luz) || 0;
    const rateioAgua = valorAgua / (aptosPagantes || 1);
    const rateioLuz = valorLuz / (aptosPagantes || 1);

    let baseTaxaCondominio = Number(valoresMensais.taxa_condominio) || 0;
    let baseFundoReserva = Number(valoresMensais.fundo_reserva) || 0;

    // Calculate due date
    const [year, month] = mes_ano.split('-');
    const diaVenc = Number(parametros.dia_vencimento) || 10;
    const dueDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, diaVenc, 12, 0, 0));

    const faturasToCreate: any[] = [];

    for (const prop of proprietarios) {
      if (ownersWithKeptInvoices.includes(prop.id)) {
        continue;
      }

      const isSindico = sindico?.proprietarioId === prop.id;
      let isentoCondominio = isSindico && !sindico.paga_condominio;
      const isentoChamadaExtra = isSindico && !sindico.paga_chamada_extra;

      if (isDividirMenosUm) {
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
          const ceValor = Number(ce.valor) || 0;
          const rateioCE = ceValor / (aptosPagantesChamadaExtra || 1);
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
        const ivVal = Number(iv.valor) || 0;
        total += ivVal;
        detalhes.itens.push({ descricao: `Valor Exclusivo: ${iv.descricao}`, valor: ivVal });
      }

      // Saldo Devedor Anterior
      const previousInvoices = previousInvoicesCountByProp.get(prop.id) || 0;
      const saldoDev = Number(prop.saldo_devedor_inicial) || 0;
      if (previousInvoices === 0 && saldoDev > 0) {
        total += saldoDev;
        detalhes.itens.push({ descricao: 'Saldo Devedor Inicial', valor: saldoDev });
      }

      // Round total to 2 decimal places
      const valor_total = Math.round(total * 100) / 100;
      const newFaturaId = crypto.randomUUID();

      faturasToCreate.push({
        id: newFaturaId,
        mes_ano,
        proprietarioId: prop.id,
        valor_total,
        data_vencimento: dueDate.toISOString(),
        status: 'PENDENTE',
        detalhes: JSON.stringify(detalhes),
        condominioId: condominioId || prop.condominioId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 1. Save to Firebase Firestore
    try {
      const { batchSetDocuments, setDocument } = await import('@/lib/firestore-service');
      const itemsToBatch = faturasToCreate.map(f => ({ id: f.id, data: f }));
      if (batchSetDocuments) {
        await batchSetDocuments('faturas', itemsToBatch);
      } else {
        for (const item of itemsToBatch) {
          await setDocument('faturas', item.id, item.data);
        }
      }
    } catch (fbSaveErr: any) {
      console.error('Error saving generated faturas to Firestore:', fbSaveErr);
    }

    // 2. Optional sync to Prisma
    try {
      await prisma.fatura.createMany({
        data: faturasToCreate.map(f => ({
          ...f,
          data_vencimento: new Date(f.data_vencimento),
        })),
      });
    } catch (prismaSaveErr: any) {
      console.warn('Prisma createMany faturas skipped/error:', prismaSaveErr?.message);
    }

    return NextResponse.json({ success: true, count: faturasToCreate.length });
  } catch (error) {
    console.error('Error generating faturas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

