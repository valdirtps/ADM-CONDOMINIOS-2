import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await params;
    const condominioId = session.user.condominioId;

    let parametros: any[] = [];
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const allParams = await listDocuments<any>('parametros');
      parametros = (allParams || [])
        .filter(p => !condominioId || p.condominioId === condominioId)
        .sort((a, b) => b.mes_ano.localeCompare(a.mes_ano));
    } catch {}

    if (parametros.length === 0) {
      try {
        parametros = await prisma.parametros.findMany({
          where: { condominioId: condominioId || undefined },
          orderBy: { mes_ano: 'desc' }
        });
      } catch {}
    }

    const parametroIndex = parametros.findIndex(p => p.id === id);
    const parametro = parametros[parametroIndex];

    if (!parametro) {
      return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });
    }

    const nextParam = parametroIndex > 0 ? parametros[parametroIndex - 1] : null;
    const isOldest = parametroIndex === parametros.length - 1;

    // Check linked records in Firestore
    let hasLinkedData = false;
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const [fList, vmList, ceList, viList] = await Promise.all([
        listDocuments<any>('faturas'),
        listDocuments<any>('valoresMensais'),
        listDocuments<any>('chamadasExtras'),
        listDocuments<any>('valoresIndividuais'),
      ]);

      const filterByRange = (items: any[]) => (items || []).filter(item => {
        if (condominioId && item.condominioId && item.condominioId !== condominioId) return false;
        if (!item.mes_ano) return false;
        if (!isOldest && item.mes_ano < parametro.mes_ano) return false;
        if (nextParam && item.mes_ano >= nextParam.mes_ano) return false;
        return true;
      });

      const fCount = filterByRange(fList).length;
      const vmCount = filterByRange(vmList).length;
      const ceCount = filterByRange(ceList).length;
      const viCount = filterByRange(viList).length;

      hasLinkedData = (fCount + vmCount + ceCount + viCount) > 0;
    } catch {}

    if (hasLinkedData) {
      return NextResponse.json({ error: 'Não é possível excluir as configurações pois já existem lançamentos vinculados a este período.' }, { status: 400 });
    }

    // 1. Delete from Firestore
    try {
      const { deleteDocument } = await import('@/lib/firestore-service');
      await deleteDocument('parametros', id);
    } catch (fbDelErr: any) {
      console.error('Error deleting parametros from Firestore:', fbDelErr);
    }

    // 2. Optional delete from Prisma
    try {
      await prisma.parametros.delete({
        where: { id }
      });
    } catch (prismaDelErr: any) {
      console.warn('Prisma delete parametros skipped/error:', prismaDelErr?.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting parametros:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

