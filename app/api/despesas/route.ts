import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const data = await request.json();
    
    if (!data.tipo || !data.referente || !data.valor || !data.data_pagamento) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    const condominioId = data.condominioId || session.user.condominioId;

    if (!condominioId) {
      return NextResponse.json({ error: 'ID do condomínio é obrigatório' }, { status: 400 });
    }

    // Find the current active property manager (síndico)
    const activeSindico = await prisma.sindico.findFirst({
      where: { condominioId: condominioId, ativo: true },
    });

    if (!activeSindico) {
      return NextResponse.json({ 
        error: 'É necessário ter um síndico vigente (ativo) cadastrado para realizar lançamentos.' 
      }, { status: 400 });
    }

    const despesa = await prisma.despesa.create({
      data: {
        tipo: data.tipo,
        valor: Number(data.valor),
        referente: data.referente,
        observacao: data.observacao || null,
        data_pagamento: new Date(data.data_pagamento),
        condominioId: condominioId,
        sindicoId: activeSindico.id,
      },
    });

    return NextResponse.json(despesa);
  } catch (error) {
    console.error('Error creating despesa:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
