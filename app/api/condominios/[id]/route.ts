import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.user.role !== 'ADMIN_SISTEMA') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const data = await request.json();
    const { nome, cnpj, endereco, numero, cidade, uf, cep, saldo_inicial, adminNome, adminEmail } = data;

    if (!nome || !cnpj || !adminNome || !adminEmail) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatórios' }, { status: 400 });
    }

    // 1. Update in Firebase Firestore
    try {
      const { setDocument, getDocument } = await import('@/lib/firestore-service');
      const existing = await getDocument<any>('condominios', id);
      const updatedData = {
        ...(existing || {}),
        id,
        nome,
        cnpj,
        endereco: endereco || '',
        numero: numero || '',
        cidade: cidade || '',
        uf: uf || '',
        cep: cep || '',
        saldo_inicial: Number(saldo_inicial) || 0,
        updatedAt: new Date().toISOString(),
        usuarios: [
          {
            ...(existing?.usuarios?.[0] || {}),
            nome: adminNome,
            email: adminEmail,
            role: 'ADMIN_CONDOMINIO',
          },
        ],
      };
      await setDocument('condominios', id, updatedData);
    } catch (fbErr: any) {
      console.warn('Firestore update warning:', fbErr.message);
    }

    // 2. Also update Prisma if available
    try {
      await prisma.$transaction(async (tx) => {
        await tx.condominio.update({
          where: { id },
          data: {
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

        const adminUser = await tx.user.findFirst({
          where: { condominioId: id, role: 'ADMIN_CONDOMINIO' },
        });

        if (adminUser) {
          await tx.user.update({
            where: { id: adminUser.id },
            data: {
              nome: adminNome,
              email: adminEmail,
            },
          });
        }
      });
    } catch (prismaErr: any) {
      // Prisma update optional
    }

    return NextResponse.json({ success: true, id, nome });
  } catch (error) {
    console.error('Erro ao atualizar condomínio:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.user.role !== 'ADMIN_SISTEMA') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // 1. Delete in Firebase Firestore
    try {
      const { deleteDocument } = await import('@/lib/firestore-service');
      await deleteDocument('condominios', id);
    } catch (fbErr: any) {
      console.warn('Firestore delete notice:', fbErr.message);
    }

    // 2. Also try deleting in Prisma if available
    try {
      // Check for existing relations
      const [
        proprietariosCount,
        faturasCount,
        despesasCount,
      ] = await Promise.all([
        prisma.proprietario.count({ where: { condominioId: id } }).catch(() => 0),
        prisma.fatura.count({ where: { condominioId: id } }).catch(() => 0),
        prisma.despesa.count({ where: { condominioId: id } }).catch(() => 0),
      ]);

      if (proprietariosCount > 0 || faturasCount > 0 || despesasCount > 0) {
        return NextResponse.json(
          { error: 'Não é possível excluir este condomínio pois ele possui vínculos (proprietários, faturas, despesas, etc).' },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.parametros.deleteMany({ where: { condominioId: id } });
        await tx.sindico.deleteMany({ where: { condominioId: id } });
        await tx.user.deleteMany({ where: { condominioId: id } });
        await tx.condominio.delete({ where: { id } });
      });
    } catch (prismaErr: any) {
      // Prisma delete optional
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir condomínio:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
