import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { proprietarioId, mes_ano, valor, descricao } = data;

    if (!proprietarioId || !mes_ano || valor === undefined || !descricao) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const condominioId = session.user.condominioId;
    if (!condominioId) {
      return NextResponse.json({ error: 'Condomínio não informado' }, { status: 400 });
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
          where: { condominioId, ativo: true },
        });
      } catch {}
    }

    if (!activeSindico) {
      return NextResponse.json({ 
        error: 'É necessário ter um síndico vigente (ativo) cadastrado para realizar lançamentos.' 
      }, { status: 400 });
    }

    const newId = crypto.randomUUID();
    const newRecord = {
      id: newId,
      proprietarioId,
      mes_ano,
      valor: Number(valor) || 0,
      descricao,
      condominioId,
      sindicoId: activeSindico.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Save to Firebase Firestore
    try {
      const { setDocument } = await import('@/lib/firestore-service');
      await setDocument('valoresIndividuais', newId, newRecord);
    } catch (fbErr: any) {
      console.error('Error saving valorIndividual to Firestore:', fbErr);
    }

    // 2. Optional sync to Prisma
    try {
      await prisma.valoresIndividuais.create({
        data: {
          id: newId,
          proprietarioId,
          mes_ano,
          valor: Number(valor) || 0,
          descricao,
          condominioId,
          sindicoId: activeSindico.id,
        }
      });
    } catch (prismaErr: any) {
      console.warn('Prisma create valorIndividual skipped/error:', prismaErr?.message);
    }

    return NextResponse.json(newRecord);
  } catch (error) {
    console.error('Failed to create valor individual:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

