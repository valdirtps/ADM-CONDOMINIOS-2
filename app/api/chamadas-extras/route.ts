import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { mes_ano, referente, valor_total, parcelas, valor } = await req.json();
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
      mes_ano,
      referente,
      valor_total: Number(valor_total) || 0,
      parcelas: Number(parcelas) || 1,
      valor: Number(valor) || 0,
      condominioId,
      sindicoId: activeSindico.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Save to Firebase Firestore
    try {
      const { setDocument } = await import('@/lib/firestore-service');
      await setDocument('chamadasExtras', newId, newRecord);
    } catch (fbErr: any) {
      console.error('Error saving chamadaExtra to Firestore:', fbErr);
    }

    // 2. Optional sync to Prisma
    try {
      await prisma.chamadaExtra.create({
        data: {
          id: newId,
          mes_ano,
          referente,
          valor_total: Number(valor_total) || 0,
          parcelas: Number(parcelas) || 1,
          valor: Number(valor) || 0,
          condominioId,
          sindicoId: activeSindico.id,
        },
      });
    } catch (prismaErr: any) {
      console.warn('Prisma create chamadaExtra skipped/error:', prismaErr?.message);
    }

    return NextResponse.json(newRecord);
  } catch (error) {
    console.error('Erro ao adicionar chamada extra:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

