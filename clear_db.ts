import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning database...');

  await prisma.fatura.deleteMany({});
  await prisma.despesa.deleteMany({});
  await prisma.creditoExtra.deleteMany({});
  await prisma.valoresIndividuais.deleteMany({});
  await prisma.chamadaExtra.deleteMany({});
  await prisma.valoresMensais.deleteMany({});
  await prisma.parametros.deleteMany({});
  
  await prisma.sindico.deleteMany({});
  await prisma.proprietario.deleteMany({});
  
  // Delete all users EXCEPT admin@sistema.com
  await prisma.user.deleteMany({
    where: {
      email: {
        not: 'admin@sistema.com'
      }
    }
  });

  await prisma.condominio.deleteMany({});

  console.log('Database cleaned from all test data. The user admin@sistema.com was kept.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
