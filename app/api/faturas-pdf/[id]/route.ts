import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { generateFaturaPDFBuffer } from '@/lib/fatura-pdf';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    let fatura: any = null;

    // 1. Try Firebase Firestore
    try {
      const { getDocument, listDocuments } = await import('@/lib/firestore-service');
      fatura = await getDocument<any>('faturas', id);
      if (fatura) {
        if (fatura.proprietarioId && !fatura.proprietario) {
          fatura.proprietario = (await getDocument<any>('proprietarios', fatura.proprietarioId)) || {
            nome: 'Proprietário',
            apartamento: '-',
            email: '',
          };
        }
        if (fatura.condominioId && !fatura.condominio) {
          fatura.condominio = (await getDocument<any>('condominios', fatura.condominioId)) || {
            nome: 'Condomínio',
            sindicos: [],
          };
        }
        if (fatura.condominio && (!Array.isArray(fatura.condominio.sindicos) || fatura.condominio.sindicos.length === 0)) {
          const allSindicos = await listDocuments<any>('sindicos');
          const activeSindico = (allSindicos || []).find(
            s => (!fatura.condominioId || s.condominioId === fatura.condominioId) && s.ativo
          );
          if (activeSindico) {
            if (activeSindico.proprietarioId && !activeSindico.proprietario) {
              activeSindico.proprietario = await getDocument<any>('proprietarios', activeSindico.proprietarioId);
            }
            fatura.condominio.sindicos = [activeSindico];
          } else {
            fatura.condominio.sindicos = [];
          }
        }
      }
    } catch (fbErr: any) {
      console.warn('Firestore lookup error in faturas-pdf:', fbErr?.message);
    }

    // 2. Fallback to Prisma
    if (!fatura) {
      try {
        fatura = await prisma.fatura.findUnique({
          where: { id },
          include: {
            proprietario: true,
            condominio: {
              include: {
                sindicos: { where: { ativo: true }, include: { proprietario: true } }
              }
            }
          },
        });
      } catch (prismaErr: any) {
        console.warn('Prisma lookup bypassed in faturas-pdf:', prismaErr?.message);
      }
    }

    if (!fatura) {
      return new NextResponse('Fatura não encontrada', { status: 404 });
    }

    const pdfBuffer = await generateFaturaPDFBuffer(fatura);
    const apto = fatura.proprietario?.apartamento || '-';

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Fatura_${fatura.mes_ano || 'mes'}_Apto_${apto}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar PDF público:', error);
    return new NextResponse('Erro interno ao gerar PDF', { status: 500 });
  }
}
