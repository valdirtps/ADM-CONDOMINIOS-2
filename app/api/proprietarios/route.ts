import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const data = await request.json();
    
    if (!data.nome || !data.apartamento) {
      return NextResponse.json({ error: 'Nome e apartamento são obrigatórios' }, { status: 400 });
    }

    const aptoTrimmed = String(data.apartamento).trim();
    const nomeTrimmed = String(data.nome).trim();
    const telefoneTrimmed = data.telefone ? String(data.telefone).trim() : '';
    const emailTrimmed = data.email ? String(data.email).trim() : '';
    const saldoNum = Number(data.saldo_devedor_inicial) || 0;
    const condominioId = session.user.condominioId || '';

    // Check duplicate in Firestore
    let isDuplicate = false;
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const docs = await listDocuments<any>('proprietarios');
      if (docs && docs.length > 0) {
        const found = docs.find(
          (p) =>
            p.apartamento?.trim().toLowerCase() === aptoTrimmed.toLowerCase() &&
            p.ativo !== false &&
            (!condominioId || !p.condominioId || p.condominioId === condominioId)
        );
        if (found) isDuplicate = true;
      }
    } catch {}

    if (!isDuplicate) {
      try {
        const existingProprietario = await prisma.proprietario.findFirst({
          where: {
            condominioId,
            apartamento: aptoTrimmed,
            ativo: true,
          },
        });
        if (existingProprietario) isDuplicate = true;
      } catch {}
    }

    if (isDuplicate) {
      return NextResponse.json({ error: 'Já existe um proprietário para este apartamento' }, { status: 400 });
    }

    let createdProprietario: any = null;
    const newId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const record = {
      id: newId,
      nome: nomeTrimmed,
      apartamento: aptoTrimmed,
      telefone: telefoneTrimmed,
      email: emailTrimmed,
      saldo_devedor_inicial: saldoNum,
      condominioId,
      ativo: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 1. Save to Firestore
    try {
      const { setDocument } = await import('@/lib/firestore-service');
      await setDocument('proprietarios', newId, record);
      createdProprietario = record;
    } catch (fsErr: any) {
      console.error('Firestore create proprietario error:', fsErr);
    }

    // 2. Best-effort sync to Prisma
    try {
      const pCreate = await prisma.proprietario.create({
        data: {
          id: newId,
          nome: nomeTrimmed,
          apartamento: aptoTrimmed,
          telefone: telefoneTrimmed,
          email: emailTrimmed,
          saldo_devedor_inicial: saldoNum,
          condominioId,
          ativo: true,
        },
      });
      if (!createdProprietario) createdProprietario = pCreate;
    } catch (prismaErr: any) {
      console.warn('Prisma create skipped:', prismaErr?.message);
    }

    if (!createdProprietario) {
      createdProprietario = record;
    }

    return NextResponse.json(createdProprietario);
  } catch (error) {
    console.error('Error creating proprietario:', error);
    return NextResponse.json({ error: 'Erro interno ao criar proprietário' }, { status: 500 });
  }
}
