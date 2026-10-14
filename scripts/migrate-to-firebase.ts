import { PrismaClient } from '@prisma/client';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import * as dotenv from 'dotenv';
dotenv.config();

// Load Firebase configuration
const firebaseConfig = require('../firebase-applet-config.json');

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const prisma = new PrismaClient();

async function runMigration() {
  console.log('--- INICIANDO MIGRAÇÃO SUPABASE -> FIREBASE ---');
  console.log(`Projeto Firebase: ${firebaseConfig.projectId}`);
  console.log(`Firestore Database ID: ${firebaseConfig.firestoreDatabaseId}`);

  async function migrateEntity(
    name: string,
    fetchFn: () => Promise<any[]>
  ) {
    try {
      console.log(`\nLendo dados de ${name}...`);
      const items = await fetchFn();
      console.log(`Encontrados ${items.length} registros em ${name}.`);
      if (items.length === 0) return;

      const chunkSize = 400;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        for (const item of chunk) {
          const docRef = doc(db, name, item.id);
          const cleaned: Record<string, any> = {};
          for (const [k, v] of Object.entries(item)) {
            if (v instanceof Date) {
              cleaned[k] = v.toISOString();
            } else if (v !== undefined) {
              cleaned[k] = v;
            }
          }
          batch.set(docRef, cleaned, { merge: true });
        }

        await batch.commit();
        console.log(`  Gravados ${Math.min(i + chunkSize, items.length)} de ${items.length} em ${name}...`);
      }
      console.log(`✓ ${name} migrado com sucesso!`);
    } catch (err: any) {
      console.error(`✕ Erro ao migrar ${name}:`, err.message);
    }
  }

  await migrateEntity('condominios', () => prisma.condominio.findMany());
  await migrateEntity('users', () => prisma.user.findMany());
  await migrateEntity('proprietarios', () => prisma.proprietario.findMany());
  await migrateEntity('sindicos', () => prisma.sindico.findMany());
  await migrateEntity('parametros', () => prisma.parametros.findMany());
  await migrateEntity('valoresMensais', () => prisma.valoresMensais.findMany());
  await migrateEntity('chamadasExtras', () => prisma.chamadaExtra.findMany());
  await migrateEntity('valoresIndividuais', () => prisma.valoresIndividuais.findMany());
  await migrateEntity('faturas', () => prisma.fatura.findMany());
  await migrateEntity('despesas', () => prisma.despesa.findMany());
  await migrateEntity('creditosExtras', () => prisma.creditoExtra.findMany());
  await migrateEntity('agendasServico', () => prisma.agendaServico.findMany());

  console.log('\n--- MIGRAÇÃO CONCLUÍDA COM SUCESSO ---');
}

runMigration()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
