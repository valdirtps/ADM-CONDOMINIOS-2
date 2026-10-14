import prisma from "@/lib/db";
import { AlertCircle, ChevronRight } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function Alerts() {
  const today = new Date();
  let pendingInvoices: any[] = [];

  // 1. Try Firebase Firestore
  try {
    const { listDocuments } = await import('@/lib/firestore-service');
    const faturas = await listDocuments<any>('faturas');
    if (faturas && faturas.length > 0) {
      const proprietarios = await listDocuments<any>('proprietarios');
      const propMap = new Map((proprietarios || []).map(p => [p.id, p]));

      pendingInvoices = faturas
        .filter(f => f.status === 'PENDENTE')
        .map(f => ({
          ...f,
          data_vencimento: new Date(f.data_vencimento),
          proprietario: f.proprietario || propMap.get(f.proprietarioId) || { nome: 'Proprietário', apartamento: '-' },
        }));
    }
  } catch {}

  // 2. Fallback to Prisma
  if (pendingInvoices.length === 0) {
    try {
      pendingInvoices = await prisma.fatura.findMany({
        where: {
          status: "PENDENTE",
        },
        include: {
          proprietario: true,
        },
        orderBy: {
          data_vencimento: 'asc'
        }
      });
    } catch {}
  }

  // Filter those overdue by more than 30 days
  const highRiskInvoices = pendingInvoices.filter(fatura => {
    const daysOverdue = differenceInDays(today, fatura.data_vencimento);
    return daysOverdue > 30;
  });

  if (highRiskInvoices.length === 0) {
    return null;
  }

  return (
    <div id="alerts-container" className="mb-8 space-y-4">
      <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border-l-4 border-red-500 rounded-r-md">
        <AlertCircle size={20} />
        <span className="font-semibold text-sm">
          Atenção: {highRiskInvoices.length} {highRiskInvoices.length === 1 ? 'fatura está' : 'faturas estão'} vencidas há mais de 30 dias.
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {highRiskInvoices.map((fatura) => {
          const daysOverdue = differenceInDays(today, fatura.data_vencimento);
          
          return (
            <div 
              key={fatura.id}
              id={`alert-card-${fatura.id}`}
              className="bg-white border border-red-100 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight">
                    {fatura.proprietario?.nome || 'Proprietário'}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    {fatura.proprietario?.apartamento || '-'}
                  </p>
                </div>
                <div className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {daysOverdue} DIAS
                </div>
              </div>
              
              <div className="flex justify-between items-end mt-4">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Vencimento</p>
                  <p className="text-sm font-medium text-gray-700">
                    {format(fatura.data_vencimento, "dd 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Valor</p>
                  <p className="text-lg font-black text-red-600">
                    R$ {(fatura.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <button 
                id={`btn-cobrar-${fatura.id}`}
                className="w-full mt-4 flex items-center justify-center gap-2 py-2 bg-gray-900 text-white text-xs font-bold rounded-md hover:bg-gray-800 transition-colors cursor-pointer"
              >
                ACESSAR COBRANÇA
                <ChevronRight size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
