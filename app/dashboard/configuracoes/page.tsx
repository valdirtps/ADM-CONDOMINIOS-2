import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { ConfiguracoesForm } from './configuracoes-form';
import { SmtpConfigForm } from './smtp-config-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sliders, Mail } from 'lucide-react';

export default async function ConfiguracoesPage() {
  const session = await getSession();
  if (!session) return null;

  let parametrosComStatus: any[] = [];

  // 1. Try Firebase Firestore
  try {
    const { listDocuments } = await import('@/lib/firestore-service');
    const docs = await listDocuments<any>('parametros');
    if (docs && docs.length > 0) {
      const filtered = docs.filter(p => !session.user.condominioId || p.condominioId === session.user.condominioId);
      parametrosComStatus = filtered.map(p => ({
        id: p.id,
        mes_ano: p.mes_ano,
        dia_vencimento: p.dia_vencimento,
        dias_isencao_multa: p.dias_isencao_multa,
        multa_percentual: p.multa_percentual,
        dividir_rateio_menos_um: p.dividir_rateio_menos_um,
        isLocked: false,
      }));
    }
  } catch {}

  // 2. Fallback to Prisma
  if (parametrosComStatus.length === 0) {
    try {
      const parametros = await prisma.parametros.findMany({
        where: { condominioId: session.user.condominioId },
        orderBy: { mes_ano: 'desc' }
      });

      parametrosComStatus = await Promise.all(parametros.map(async (p, index) => {
        const nextParam = index > 0 ? parametros[index - 1] : null;
        const isOldest = index === parametros.length - 1;
        
        const whereClause: any = {
          condominioId: session.user.condominioId,
          mes_ano: {}
        };
        
        if (!isOldest) {
          whereClause.mes_ano.gte = p.mes_ano;
        }
        
        if (nextParam) {
          whereClause.mes_ano.lt = nextParam.mes_ano;
        }

        if (Object.keys(whereClause.mes_ano).length === 0) {
          delete whereClause.mes_ano;
        }

        const [faturasCount, valoresMensaisCount, chamadasExtrasCount, valoresIndividuaisCount] = await Promise.all([
          prisma.fatura.count({ where: whereClause }).catch(() => 0),
          prisma.valoresMensais.count({ where: whereClause }).catch(() => 0),
          prisma.chamadaExtra.count({ where: whereClause }).catch(() => 0),
          prisma.valoresIndividuais.count({ where: whereClause }).catch(() => 0),
        ]);
        const isLocked = (faturasCount + valoresMensaisCount + chamadasExtrasCount + valoresIndividuaisCount) > 0;
        return { 
          id: p.id,
          mes_ano: p.mes_ano,
          dia_vencimento: p.dia_vencimento,
          dias_isencao_multa: p.dias_isencao_multa,
          multa_percentual: p.multa_percentual,
          dividir_rateio_menos_um: p.dividir_rateio_menos_um,
          isLocked 
        };
      }));
    } catch {}
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações do Condomínio</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie os parâmetros de cobrança do condomínio e as credenciais para envio de e-mails de faturas.
        </p>
      </div>

      <Tabs defaultValue="email" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            E-mail (SMTP)
          </TabsTrigger>
          <TabsTrigger value="parametros" className="flex items-center gap-2">
            <Sliders className="h-4 w-4" />
            Parâmetros de Cobrança
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-6">
          <SmtpConfigForm userEmail={session.user.email} />
        </TabsContent>

        <TabsContent value="parametros" className="space-y-6">
          <ConfiguracoesForm initialData={parametrosComStatus} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
