import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const fatura = await prisma.fatura.findUnique({
      where: { id, condominioId: session.user.condominioId },
    });

    if (!fatura) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
    }

    if (fatura.status !== 'PAGO') {
      return NextResponse.json({ error: 'Apenas faturas pagas podem ser reabertas' }, { status: 400 });
    }

    // Try to find and delete associated individual values created for underpayment
    if (fatura.data_pagamento) {
      const { format } = await import('date-fns');
      const dataPgtoFormatada = format(new Date(fatura.data_pagamento.getTime() + new Date().getTimezoneOffset() * 60000), 'dd/MM/yyyy');
      const targetDesc = `Multa/Juros por Atraso (Pgto em ${dataPgtoFormatada})`;

      // Find individual values for this owner that match the description and were likely created for the next month
      await prisma.valoresIndividuais.deleteMany({
        where: {
          proprietarioId: fatura.proprietarioId,
          condominioId: session.user.condominioId,
          descricao: targetDesc,
          // We only delete if it hasn't been "used" in a paid fatura yet.
          // But actually, if we re-open this fatura, we want to revert its consequences.
        },
      });
    }

    // Update Fatura to return to PENDENTE status and clear payment info
    await prisma.fatura.update({
      where: { id },
      data: {
        status: 'PENDENTE',
        data_pagamento: null,
        valor_pago: null,
        multa: 0,
        juros: 0,
        dias_atraso: 0,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reopening fatura:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
