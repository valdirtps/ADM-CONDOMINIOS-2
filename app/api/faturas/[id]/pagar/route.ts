import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { format } from 'date-fns';
import crypto from 'crypto';

function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = cleanUndefined(value);
    }
  }
  return result;
}

function parseNumber(val: any, fallback = 0): number {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/\s+/g, '').replace('R$', '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}

function parseDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val === 'string') {
    const brMatch = val.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) {
      return new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}T12:00:00Z`);
    }
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { data_pagamento, valor_pago } = body;
    
    if (!data_pagamento || valor_pago === undefined) {
      return NextResponse.json({ error: 'Dados inválidos para registrar pagamento' }, { status: 400 });
    }

    let fatura: any = null;

    // 1. Try Firebase Firestore
    try {
      const { getDocument } = await import('@/lib/firestore-service');
      fatura = await getDocument<any>('faturas', id);
    } catch (fbErr: any) {
      console.warn('Firestore lookup warning in pagar:', fbErr?.message);
    }

    // 2. Fallback to Prisma
    if (!fatura) {
      try {
        fatura = await prisma.fatura.findUnique({
          where: { id },
          include: { proprietario: true },
        });
      } catch (prismaErr: any) {
        console.warn('Prisma lookup bypassed in pagar:', prismaErr?.message);
      }
    }

    if (!fatura) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
    }

    if (session.user.role !== 'ADMIN_SISTEMA' && session.user.condominioId && fatura.condominioId && fatura.condominioId !== session.user.condominioId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    if (fatura.status === 'PAGO') {
      return NextResponse.json({ error: 'Fatura já está registrada como paga' }, { status: 400 });
    }

    // Get parameters for late fees / fine calculations
    let parametros: any = null;
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const allParams = await listDocuments<any>('parametros');
      const condoParams = (allParams || [])
        .filter(p => (!fatura.condominioId || p.condominioId === fatura.condominioId) && (!fatura.mes_ano || !p.mes_ano || p.mes_ano <= fatura.mes_ano))
        .sort((a, b) => (b.mes_ano || '').localeCompare(a.mes_ano || ''));
      parametros = condoParams[0] || null;
    } catch (fbParamErr: any) {
      console.warn('Firestore param lookup warning in pagar:', fbParamErr?.message);
    }

    if (!parametros) {
      try {
        const parametrosList = await prisma.parametros.findMany({
          where: { 
            condominioId: fatura.condominioId || session.user.condominioId,
            mes_ano: { lte: fatura.mes_ano || '2099-12' }
          },
          orderBy: { mes_ano: 'desc' },
          take: 1
        });
        parametros = parametrosList[0] || null;
      } catch (prismaParamErr: any) {
        console.warn('Prisma param lookup bypassed in pagar:', prismaParamErr?.message);
      }
    }

    const dataVencimento = parseDate(fatura.data_vencimento);
    const dataPagamento = parseDate(data_pagamento);
    const numValorPago = parseNumber(valor_pago, Number(fatura.valor_total) || 0);
    const numValorTotal = parseNumber(fatura.valor_total, 0);

    // Calculate delay in days
    const diffTime = Math.max(0, dataPagamento.getTime() - dataVencimento.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let multa = 0;
    let juros = 0;
    
    const isencaoDias = Number(parametros?.dias_isencao_multa ?? 0);
    if (parametros && diffDays > isencaoDias) {
      const percMulta = Number(parametros.multa_percentual || 0) / 100;
      multa = Math.round((numValorTotal * percMulta / 30 * diffDays) * 100) / 100;
    }

    const valorDevido = Math.round((numValorTotal + multa + juros) * 100) / 100;
    const diferenca = Math.round((valorDevido - numValorPago) * 100) / 100;

    // Remove proprietario relation object if it exists before saving to faturas collection
    const { proprietario, ...faturaRawData } = fatura;

    const updatedFaturaData = cleanUndefined({
      ...faturaRawData,
      data_pagamento: dataPagamento.toISOString(),
      valor_pago: numValorPago,
      dias_atraso: diffDays,
      multa,
      juros,
      status: 'PAGO',
      updatedAt: new Date().toISOString(),
    });

    // Calculate next month info if underpaid
    let nextMesAno = '';
    let valIndvId = '';
    let valIndvData: any = null;

    if (diferenca > 0.01) {
      const mesAno = fatura.mes_ano || format(new Date(), 'yyyy-MM');
      const parts = mesAno.split('-');
      let year = parseInt(parts[0]) || new Date().getFullYear();
      let month = parseInt(parts[1]) || (new Date().getMonth() + 1);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      nextMesAno = `${year}-${String(month).padStart(2, '0')}`;
      
      let dataPgtoFormatada = '';
      try {
        dataPgtoFormatada = format(new Date(dataPagamento.getTime() + new Date().getTimezoneOffset() * 60000), 'dd/MM/yyyy');
      } catch {
        dataPgtoFormatada = format(dataPagamento, 'dd/MM/yyyy');
      }

      valIndvId = crypto.randomUUID();
      valIndvData = cleanUndefined({
        id: valIndvId,
        mes_ano: nextMesAno,
        valor: diferenca,
        descricao: `Multa/Juros por Atraso (Pgto em ${dataPgtoFormatada})`,
        proprietarioId: fatura.proprietarioId || '',
        condominioId: fatura.condominioId || session.user.condominioId || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 1. Update in Firestore
    try {
      const { setDocument, listDocuments } = await import('@/lib/firestore-service');
      await setDocument('faturas', id, updatedFaturaData);

      if (valIndvData) {
        await setDocument('valoresIndividuais', valIndvId, valIndvData);

        // Update the next month's invoice if it's already generated and still pending
        const allFaturas = await listDocuments<any>('faturas');
        const nextFatura = (allFaturas || []).find(
          f => f.proprietarioId === fatura.proprietarioId && f.mes_ano === nextMesAno && f.status === 'PENDENTE'
        );

        if (nextFatura) {
          let detalhesObj: any = { itens: [] };
          if (nextFatura.detalhes) {
            try {
              detalhesObj = typeof nextFatura.detalhes === 'string' ? JSON.parse(nextFatura.detalhes) : nextFatura.detalhes;
            } catch (e) {}
          }
          if (!detalhesObj || typeof detalhesObj !== 'object') detalhesObj = {};
          if (!Array.isArray(detalhesObj.itens)) detalhesObj.itens = [];
          
          detalhesObj.itens.push({
            descricao: `Valor Exclusivo: ${valIndvData.descricao}`,
            valor: valIndvData.valor
          });

          const valTotal = Math.round(((Number(nextFatura.valor_total) || 0) + valIndvData.valor) * 100) / 100;
          const { proprietario: nextProp, ...nextFaturaRaw } = nextFatura;

          await setDocument('faturas', nextFatura.id, cleanUndefined({
            ...nextFaturaRaw,
            valor_total: valTotal,
            detalhes: JSON.stringify(detalhesObj),
            updatedAt: new Date().toISOString(),
          }));
        }
      }
    } catch (fbSaveErr: any) {
      console.error('Error saving fatura payment to Firestore:', fbSaveErr);
      return NextResponse.json({ error: 'Erro ao salvar pagamento no banco de dados' }, { status: 500 });
    }

    // 2. Optional non-blocking sync to Prisma
    (async () => {
      try {
        await prisma.fatura.update({
          where: { id },
          data: {
            data_pagamento: dataPagamento,
            valor_pago: numValorPago,
            dias_atraso: diffDays,
            multa,
            juros,
            status: 'PAGO',
          },
        });

        if (valIndvData) {
          await prisma.valoresIndividuais.create({
            data: {
              id: valIndvId,
              mes_ano: nextMesAno,
              valor: diferenca,
              descricao: valIndvData.descricao,
              proprietarioId: fatura.proprietarioId,
              condominioId: fatura.condominioId || session.user.condominioId,
            },
          });

          const nextFatura = await prisma.fatura.findFirst({
            where: {
              proprietarioId: fatura.proprietarioId,
              mes_ano: nextMesAno,
              status: 'PENDENTE',
            }
          });

          if (nextFatura) {
            let detalhesObj: any = { itens: [] };
            if (nextFatura.detalhes) {
              try { detalhesObj = JSON.parse(nextFatura.detalhes); } catch(e){}
            }
            if (!detalhesObj.itens) detalhesObj.itens = [];
            
            detalhesObj.itens.push({
              descricao: `Valor Exclusivo: ${valIndvData.descricao}`,
              valor: valIndvData.valor
            });

            const valTotal = Math.round((Number(nextFatura.valor_total) + valIndvData.valor) * 100) / 100;

            await prisma.fatura.update({
              where: { id: nextFatura.id },
              data: {
                valor_total: valTotal,
                detalhes: JSON.stringify(detalhesObj)
              }
            });
          }
        }
      } catch (prismaSyncErr: any) {
        // Prisma sync skipped if external DB unreachable
      }
    })().catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error paying fatura:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
