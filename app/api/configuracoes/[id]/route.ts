import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await params;

    const parametros = await prisma.parametros.findMany({
      where: { condominioId: session.user.condominioId },
      orderBy: { mes_ano: 'desc' }
    });

    const parametroIndex = parametros.findIndex(p => p.id === id);
    const parametro = parametros[parametroIndex];

    if (!parametro) {
      return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });
    }

    const nextParam = parametroIndex > 0 ? parametros[parametroIndex - 1] : null;
    const isOldest = parametroIndex === parametros.length - 1;
    
    const whereClause: any = {
      condominioId: session.user.condominioId,
      mes_ano: {}
    };
    
    if (!isOldest) {
      whereClause.mes_ano.gte = parametro.mes_ano;
    }
    
    if (nextParam) {
      whereClause.mes_ano.lt = nextParam.mes_ano;
    }

    // If there are no conditions on mes_ano, remove it to avoid empty object query
    if (Object.keys(whereClause.mes_ano).length === 0) {
      delete whereClause.mes_ano;
    }

    // Check if there are any linked records for this mes_ano range
    const [faturasCount, valoresMensaisCount, chamadasExtrasCount, valoresIndividuaisCount] = await Promise.all([
      prisma.fatura.count({ where: whereClause }),
      prisma.valoresMensais.count({ where: whereClause }),
      prisma.chamadaExtra.count({ where: whereClause }),
      prisma.valoresIndividuais.count({ where: whereClause }),
    ]);

    const hasLinkedData = (faturasCount + valoresMensaisCount + chamadasExtrasCount + valoresIndividuaisCount) > 0;

    if (hasLinkedData) {
      return NextResponse.json({ error: 'Não é possível excluir as configurações pois já existem lançamentos vinculados a este período.' }, { status: 400 });
    }

    await prisma.parametros.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting parametros:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
