import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { PrismaClient } from '@prisma/client';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

const COLLECTIONS = [
  'condominios',
  'users',
  'proprietarios',
  'sindicos',
  'parametros',
  'valoresMensais',
  'chamadasExtras',
  'valoresIndividuais',
  'faturas',
  'despesas',
  'creditosExtras',
  'agendasServico',
] as const;

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.user.role !== 'ADMIN_SISTEMA' && session.user.role !== 'ADMIN_CONDOMINIO')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 1. Check Firestore counts
    const firestoreCounts: Record<string, number> = {};
    for (const colName of COLLECTIONS) {
      try {
        const snap = await getDocs(collection(db, colName));
        firestoreCounts[colName] = snap.size;
      } catch (err: any) {
        firestoreCounts[colName] = 0;
      }
    }

    // 2. Check Supabase / Prisma counts
    let supabaseStatus = 'disconnected';
    let supabaseCounts: Record<string, number> = {};
    let supabaseError: string | null = null;

    try {
      if (process.env.DATABASE_URL || process.env.DIRECT_URL) {
        const [
          condominios,
          users,
          proprietarios,
          sindicos,
          parametros,
          valoresMensais,
          chamadasExtras,
          valoresIndividuais,
          faturas,
          despesas,
          creditosExtras,
          agendasServico,
        ] = await Promise.all([
          prisma.condominio.count().catch(() => 0),
          prisma.user.count().catch(() => 0),
          prisma.proprietario.count().catch(() => 0),
          prisma.sindico.count().catch(() => 0),
          prisma.parametros.count().catch(() => 0),
          prisma.valoresMensais.count().catch(() => 0),
          prisma.chamadaExtra.count().catch(() => 0),
          prisma.valoresIndividuais.count().catch(() => 0),
          prisma.fatura.count().catch(() => 0),
          prisma.despesa.count().catch(() => 0),
          prisma.creditoExtra.count().catch(() => 0),
          prisma.agendaServico.count().catch(() => 0),
        ]);

        supabaseCounts = {
          condominios,
          users,
          proprietarios,
          sindicos,
          parametros,
          valoresMensais,
          chamadasExtras,
          valoresIndividuais,
          faturas,
          despesas,
          creditosExtras,
          agendasServico,
        };
        supabaseStatus = 'connected';
      } else {
        supabaseStatus = 'no_connection_string';
      }
    } catch (err: any) {
      supabaseStatus = 'error';
      supabaseError = err.message;
    }

    return NextResponse.json({
      firebase: {
        status: 'connected',
        projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0853638886',
        counts: firestoreCounts,
      },
      supabase: {
        status: supabaseStatus,
        error: supabaseError,
        counts: supabaseCounts,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.user.role !== 'ADMIN_SISTEMA' && session.user.role !== 'ADMIN_CONDOMINIO')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const customDatabaseUrl = body.databaseUrl;

    let clientToUse = prisma;
    let customClient: PrismaClient | null = null;

    if (customDatabaseUrl) {
      customClient = new PrismaClient({
        datasources: {
          db: {
            url: customDatabaseUrl,
          },
        },
      });
      clientToUse = customClient;
    }

    const results: Record<string, { totalLidos: number; totalGravados: number; erro?: string }> = {};

    async function migrateTable(
      colName: string,
      fetchFn: () => Promise<any[]>,
      transformFn: (item: any) => any = (item) => item
    ) {
      try {
        const rows = await fetchFn();
        results[colName] = { totalLidos: rows.length, totalGravados: 0 };

        if (rows.length === 0) return;

        const chunkSize = 400;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const batch = writeBatch(db);

          for (const item of chunk) {
            const transformed = transformFn(item);
            const docRef = doc(db, colName, item.id);
            // Convert Dates to ISO strings for clean JSON Firestore compatibility
            const cleaned: Record<string, any> = {};
            for (const [k, v] of Object.entries(transformed)) {
              if (v instanceof Date) {
                cleaned[k] = v.toISOString();
              } else if (v !== undefined) {
                cleaned[k] = v;
              }
            }
            batch.set(docRef, cleaned, { merge: true });
          }

          await batch.commit();
          results[colName].totalGravados += chunk.length;
        }
      } catch (err: any) {
        results[colName] = {
          totalLidos: 0,
          totalGravados: 0,
          erro: err.message,
        };
      }
    }

    // 1. Condominios
    await migrateTable('condominios', () => clientToUse.condominio.findMany());

    // 2. Users
    await migrateTable('users', () => clientToUse.user.findMany());

    // 3. Proprietarios
    await migrateTable('proprietarios', () => clientToUse.proprietario.findMany());

    // 4. Sindicos
    await migrateTable('sindicos', () => clientToUse.sindico.findMany());

    // 5. Parametros
    await migrateTable('parametros', () => clientToUse.parametros.findMany());

    // 6. Valores Mensais
    await migrateTable('valoresMensais', () => clientToUse.valoresMensais.findMany());

    // 7. Chamadas Extras
    await migrateTable('chamadasExtras', () => clientToUse.chamadaExtra.findMany());

    // 8. Valores Individuais
    await migrateTable('valoresIndividuais', () => clientToUse.valoresIndividuais.findMany());

    // 9. Faturas
    await migrateTable('faturas', () => clientToUse.fatura.findMany());

    // 10. Despesas
    await migrateTable('despesas', () => clientToUse.despesa.findMany());

    // 11. Creditos Extras
    await migrateTable('creditosExtras', () => clientToUse.creditoExtra.findMany());

    // 12. Agendas de Servico
    await migrateTable('agendasServico', () => clientToUse.agendaServico.findMany());

    if (customClient) {
      await customClient.$disconnect();
    }

    return NextResponse.json({
      success: true,
      message: 'Migração para o Firebase concluída!',
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
