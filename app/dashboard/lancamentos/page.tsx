import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { LancamentosClient } from './lancamentos-client';

export default async function LancamentosPage() {
  const session = await getSession();
  if (!session) return null;

  let despesas: any[] = [];
  let valoresMensais: any[] = [];
  let chamadasExtras: any[] = [];
  let parametros: any[] = [];
  let sindico: any = null;
  let proprietarios: any[] = [];
  let valoresIndividuais: any[] = [];
  let creditosExtras: any[] = [];

  // 1. Try Firebase Firestore
  try {
    const { listDocuments } = await import('@/lib/firestore-service');
    const [dDocs, vDocs, cDocs, pDocs, sDocs, prDocs, viDocs, crDocs] = await Promise.all([
      listDocuments<any>('despesas'),
      listDocuments<any>('valoresMensais'),
      listDocuments<any>('chamadasExtras'),
      listDocuments<any>('parametros'),
      listDocuments<any>('sindicos'),
      listDocuments<any>('proprietarios'),
      listDocuments<any>('valoresIndividuais'),
      listDocuments<any>('creditosExtras'),
    ]);

    const cId = session.user.condominioId;
    if (dDocs) despesas = dDocs.filter(d => !cId || d.condominioId === cId);
    if (vDocs) valoresMensais = vDocs.filter(v => !cId || v.condominioId === cId);
    if (cDocs) chamadasExtras = cDocs.filter(c => !cId || c.condominioId === cId);
    if (pDocs) parametros = pDocs.filter(p => !cId || p.condominioId === cId);
    if (sDocs) sindico = sDocs.find(s => (!cId || s.condominioId === cId) && s.ativo !== false) || null;
    if (prDocs) proprietarios = prDocs.filter(p => (!cId || p.condominioId === cId) && p.ativo !== false);
    if (viDocs) {
      const propMap = new Map((proprietarios || []).map(p => [p.id, p]));
      valoresIndividuais = viDocs
        .filter(v => (!cId || v.condominioId === cId) && !v.descricao?.toLowerCase().includes('atraso (pgto em'))
        .map(v => ({
          ...v,
          proprietario: v.proprietario || propMap.get(v.proprietarioId) || { apartamento: '-', nome: 'Proprietário' }
        }));
    }
    if (crDocs) creditosExtras = crDocs.filter(c => !cId || c.condominioId === cId);
  } catch {}

  // 2. Fallback to Prisma if Firestore returned nothing
  if (despesas.length === 0 && valoresMensais.length === 0 && parametros.length === 0) {
    try {
      const [
        dRes, vRes, cRes, pRes, sRes, prRes, viRes, crRes
      ] = await Promise.all([
        prisma.despesa.findMany({ where: { condominioId: session.user.condominioId }, orderBy: { data_pagamento: 'desc' } }).catch(() => []),
        prisma.valoresMensais.findMany({ where: { condominioId: session.user.condominioId }, orderBy: { mes_ano: 'desc' } }).catch(() => []),
        prisma.chamadaExtra.findMany({ where: { condominioId: session.user.condominioId } }).catch(() => []),
        prisma.parametros.findMany({ where: { condominioId: session.user.condominioId }, orderBy: { mes_ano: 'desc' } }).catch(() => []),
        prisma.sindico.findFirst({ where: { condominioId: session.user.condominioId, ativo: true } }).catch(() => null),
        prisma.proprietario.findMany({ where: { condominioId: session.user.condominioId, ativo: true } }).catch(() => []),
        prisma.valoresIndividuais.findMany({ where: { condominioId: session.user.condominioId }, include: { proprietario: true }, orderBy: { createdAt: 'desc' } }).catch(() => []),
        prisma.creditoExtra.findMany({ where: { condominioId: session.user.condominioId }, orderBy: { mes_ano: 'desc' } }).catch(() => []),
      ]);

      despesas = dRes;
      valoresMensais = vRes;
      chamadasExtras = cRes;
      parametros = pRes;
      sindico = sRes;
      proprietarios = prRes;
      valoresIndividuais = viRes.filter((v: any) => !v.descricao?.toLowerCase().includes('atraso (pgto em'));
      creditosExtras = crRes;
    } catch {}
  }

  return <LancamentosClient 
    despesas={despesas} 
    valoresMensais={valoresMensais} 
    chamadasExtras={chamadasExtras}
    valoresIndividuais={valoresIndividuais}
    creditosExtras={creditosExtras}
    parametros={parametros}
    sindico={sindico}
    proprietarios={proprietarios}
  />;
}
