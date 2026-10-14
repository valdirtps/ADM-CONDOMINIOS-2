import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@sistema.com' },
    update: {
      senha: hashedPassword,
    },
    create: {
      email: 'admin@sistema.com',
      nome: 'Admin Sistema',
      senha: hashedPassword,
      role: 'ADMIN_SISTEMA',
    },
  });

  console.log('Admin user created:', admin.email);

  // Create a test condominium
  const condominio = await prisma.condominio.create({
    data: {
      nome: 'Condomínio Teste',
      cnpj: '00.000.000/0001-00',
      endereco: 'Rua Teste, 123',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '00000-000',
      saldo_inicial: 1000,
      parametros: {
        create: {
          mes_ano: '2026-01',
          dia_vencimento: 10,
          dias_isencao_multa: 5,
          multa_percentual: 2.0,
        }
      }
    }
  });

  console.log('Condominio created:', condominio.nome);

  // Create an admin for this condominium
  const condominioAdmin = await prisma.user.create({
    data: {
      email: 'sindico@teste.com',
      nome: 'Síndico Teste',
      senha: hashedPassword,
      role: 'ADMIN_CONDOMINIO',
      condominioId: condominio.id,
    }
  });

  console.log('Condominio admin created:', condominioAdmin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
