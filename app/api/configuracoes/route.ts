import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const data = await request.json();
    
    // Check if updating an existing parameter
    const existingParametro = await prisma.parametros.findUnique({
      where: {
        condominioId_mes_ano: {
          condominioId: session.user.condominioId,
          mes_ano: data.mes_ano
        }
      }
    });

    if (existingParametro) {
      // Check if there are any linked records for this mes_ano
      const [faturasCount, valoresMensaisCount, chamadasExtrasCount, valoresIndividuaisCount] = await Promise.all([
        prisma.fatura.count({ where: { condominioId: session.user.condominioId, mes_ano: data.mes_ano } }),
        prisma.valoresMensais.count({ where: { condominioId: session.user.condominioId, mes_ano: data.mes_ano } }),
        prisma.chamadaExtra.count({ where: { condominioId: session.user.condominioId, mes_ano: data.mes_ano } }),
        prisma.valoresIndividuais.count({ where: { condominioId: session.user.condominioId, mes_ano: data.mes_ano } }),
      ]);

      const hasLinkedData = (faturasCount + valoresMensaisCount + chamadasExtrasCount + valoresIndividuaisCount) > 0;

      if (hasLinkedData) {
        return NextResponse.json({ error: 'Não é possível alterar as configurações pois já existem lançamentos vinculados a este período.' }, { status: 400 });
      }
    }
    
    const parametros = await prisma.parametros.upsert({
      where: { 
        condominioId_mes_ano: {
          condominioId: session.user.condominioId,
          mes_ano: data.mes_ano
        }
      },
      update: {
        dia_vencimento: data.dia_vencimento,
        dias_isencao_multa: data.dias_isencao_multa,
        multa_percentual: data.multa_percentual,
        dividir_rateio_menos_um: data.dividir_rateio_menos_um,
      },
      create: {
        mes_ano: data.mes_ano,
        dia_vencimento: data.dia_vencimento,
        dias_isencao_multa: data.dias_isencao_multa,
        multa_percentual: data.multa_percentual,
        dividir_rateio_menos_um: data.dividir_rateio_menos_um,
        condominioId: session.user.condominioId,
      },
    });

    return NextResponse.json(parametros);
  } catch (error) {
    console.error('Error updating parametros:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
