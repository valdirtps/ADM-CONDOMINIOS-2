import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.user.role !== 'ADMIN_SISTEMA') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const { nome, cnpj, endereco, numero, cidade, uf, cep, saldo_inicial, adminNome, adminEmail, adminSenha } = data;

    if (!nome || !cnpj || !adminNome || !adminEmail || !adminSenha) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatórios' }, { status: 400 });
    }

    let existingUser = null;
    try {
      existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    } catch {}

    if (!existingUser) {
      try {
        const { getDocument } = await import('@/lib/firestore-service');
        existingUser = await getDocument('users', adminEmail);
      } catch {}
    }

    if (existingUser) {
      return NextResponse.json({ error: 'E-mail do administrador já está em uso' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(adminSenha, 10);
    const condoId = `condo-${Date.now()}`;
    const userId = `user-${Date.now()}`;

    const novoCondominioData = {
      id: condoId,
      nome,
      cnpj,
      endereco: endereco || '',
      numero: numero || '',
      cidade: cidade || '',
      uf: uf || '',
      cep: cep || '',
      saldo_inicial: Number(saldo_inicial) || 0,
      createdAt: new Date().toISOString(),
      usuarios: [
        {
          id: userId,
          nome: adminNome,
          email: adminEmail,
          role: 'ADMIN_CONDOMINIO',
        },
      ],
    };

    // 1. Save to Firebase Firestore
    try {
      const { setDocument } = await import('@/lib/firestore-service');
      await setDocument('condominios', condoId, novoCondominioData);
      await setDocument('users', userId, {
        id: userId,
        nome: adminNome,
        email: adminEmail,
        senha: hashedPassword,
        role: 'ADMIN_CONDOMINIO',
        condominioId: condoId,
        createdAt: new Date().toISOString(),
      });
    } catch (fbErr: any) {
      console.warn('Firestore write notice:', fbErr.message);
    }

    // 2. Also try Prisma if database is available
    try {
      await prisma.$transaction(async (tx) => {
        const c = await tx.condominio.create({
          data: {
            id: condoId,
            nome,
            cnpj,
            endereco: endereco || '',
            numero: numero || '',
            cidade: cidade || '',
            uf: uf || '',
            cep: cep || '',
            saldo_inicial: Number(saldo_inicial) || 0,
          },
        });

        await tx.user.create({
          data: {
            id: userId,
            nome: adminNome,
            email: adminEmail,
            senha: hashedPassword,
            role: 'ADMIN_CONDOMINIO',
            condominioId: c.id,
          },
        });
      });
    } catch (prismaErr: any) {
      // Prisma write optional if Supabase is offline
    }

    return NextResponse.json(novoCondominioData);
  } catch (error: any) {
    console.error('Erro ao criar condomínio:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
