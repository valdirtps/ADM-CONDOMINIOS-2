import prisma from '@/lib/db';
import { AlertCircle, ChevronRight } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default async function DashboardAlerts({ condominioId }: { condominioId: string }) {
  const today = new Date();
  let overdueInvoices: any[] = [];

  // 1. Try Firebase Firestore
  try {
    const { listDocuments } = await import('@/lib/firestore-service');
    const faturas = await listDocuments<any>('faturas');
    if (faturas && faturas.length > 0) {
      const proprietarios = await listDocuments<any>('proprietarios');
      const propMap = new Map((proprietarios || []).map(p => [p.id, p]));

      overdueInvoices = faturas
        .filter(f => f.condominioId === condominioId && ['PENDENTE', 'ATRASADO', 'PARCIAL'].includes(f.status))
        .map(f => ({
          ...f,
          data_vencimento: new Date(f.data_vencimento),
          proprietario: f.proprietario || propMap.get(f.proprietarioId) || { nome: 'Proprietário', apartamento: '-' },
        }))
        .filter(f => f.data_vencimento < today);
    }
  } catch {}

  // 2. Fallback to Prisma
  if (overdueInvoices.length === 0) {
    try {
      overdueInvoices = await prisma.fatura.findMany({
        where: {
          condominioId,
          status: {
            in: ['PENDENTE', 'ATRASADO', 'PARCIAL']
          },
          data_vencimento: {
            lt: today
          }
        },
        include: {
          proprietario: true
        },
        orderBy: {
          data_vencimento: 'asc'
        }
      });
    } catch {}
  }

  // Filtrar as que estão vencidas há mais de 30 dias
  const criticalInvoices = overdueInvoices.filter(f => {
    const days = differenceInDays(today, f.data_vencimento);
    return days > 30;
  });

  if (criticalInvoices.length === 0) return null;

  return (
    <div id="dashboard-alerts" className="space-y-4 mb-6">
      <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span className="font-semibold text-sm">
          Atenção: {criticalInvoices.length} {criticalInvoices.length === 1 ? 'fatura está' : 'faturas estão'} vencidas há mais de 30 dias.
        </span>
      </div>
      
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {criticalInvoices.map((fatura) => {
          const daysOverdue = differenceInDays(today, fatura.data_vencimento);
          return (
            <Card key={fatura.id} id={`alert-card-${fatura.id}`} className="border-destructive/20 hover:ring-destructive/30 transition-shadow transition-all group">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-sm text-foreground leading-tight">
                      {fatura.proprietario?.nome || 'Proprietário'}
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium">
                      {fatura.proprietario?.apartamento || '-'}
                    </p>
                  </div>
                  <div className="bg-destructive/10 text-destructive text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shrink-0">
                    {daysOverdue} DIAS
                  </div>
                </div>
                
                <div className="flex justify-between items-end mt-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-none mb-1">Vencimento</p>
                    <p className="text-sm font-semibold text-foreground">
                      {format(fatura.data_vencimento, "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-none mb-1">Total</p>
                    <p className="text-lg font-black text-destructive tracking-tight">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fatura.valor_total || 0)}
                    </p>
                  </div>
                </div>

                <Link 
                  href={`/dashboard/faturas/${fatura.id}`}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-foreground text-background text-xs font-black rounded-lg hover:bg-foreground/90 transition-colors uppercase tracking-widest"
                >
                  Cobrar Agora
                  <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
