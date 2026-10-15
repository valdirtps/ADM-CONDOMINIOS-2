import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const session = await getSession(request);
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
    let activeSindico: any = null;
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const sindicos = await listDocuments<any>('sindicos');
      activeSindico = (sindicos || []).find(
        s => s.condominioId === condominioId && s.ativo !== false
      ) || null;
    } catch {}

    if (!activeSindico) {
      try {
        activeSindico = await prisma.sindico.findFirst({
          where: { condominioId: condominioId, ativo: true },
        });
      } catch {}
    }

    if (!activeSindico) {
      return NextResponse.json({ 
        error: 'É necessário ter um síndico vigente (ativo) cadastrado para realizar lançamentos.' 
      }, { status: 400 });
    }

    const newId = crypto.randomUUID();
    const newDespesa = {
      id: newId,
      tipo: data.tipo,
      valor: Number(data.valor),
      referente: data.referente,
      observacao: data.observacao || null,
      data_pagamento: new Date(data.data_pagamento).toISOString(),
      condominioId: condominioId,
      sindicoId: activeSindico.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Save to Firebase Firestore
    try {
      const { setDocument } = await import('@/lib/firestore-service');
      await setDocument('despesas', newId, newDespesa);
    } catch (fbErr: any) {
      console.error('Error saving despesa to Firestore:', fbErr);
    }

    // 2. Optional sync to Prisma
    try {
      await prisma.despesa.create({
        data: {
          id: newId,
          tipo: data.tipo,
          valor: Number(data.valor),
          referente: data.referente,
          observacao: data.observacao || null,
          data_pagamento: new Date(data.data_pagamento),
          condominioId: condominioId,
          sindicoId: activeSindico.id,
        },
      });
    } catch (prismaErr: any) {
      console.warn('Prisma create despesa skipped/error:', prismaErr?.message);
    }

    return NextResponse.json(newDespesa);
  } catch (error) {
    console.error('Error creating despesa:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

