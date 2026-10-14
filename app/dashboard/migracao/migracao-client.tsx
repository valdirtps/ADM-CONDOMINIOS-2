'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Database, Flame, ArrowRight, RefreshCw, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

interface MigrationStatus {
  firebase: {
    status: string;
    projectId: string;
    counts: Record<string, number>;
  };
  supabase: {
    status: string;
    error: string | null;
    counts: Record<string, number>;
  };
}

const COLLECTION_LABELS: Record<string, string> = {
  condominios: 'Condomínios',
  users: 'Usuários de Sistema',
  proprietarios: 'Proprietários',
  sindicos: 'Síndicos e Mandatos',
  parametros: 'Parâmetros / Configurações',
  valoresMensais: 'Valores Mensais (Água/Luz/Taxa)',
  chamadasExtras: 'Chamadas Extras',
  valoresIndividuais: 'Cobranças Individuais',
  faturas: 'Faturas e Boletos',
  despesas: 'Despesas Registradas',
  creditosExtras: 'Créditos Extras',
  agendasServico: 'Agenda de Serviços',
};

export function MigracaoClient() {
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [customDbUrl, setCustomDbUrl] = useState('');
  const [lastResult, setLastResult] = useState<any>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/migracao');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        toast.error('Erro ao verificar status dos bancos de dados');
      }
    } catch {
      toast.error('Falha de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleMigrate = async () => {
    setMigrating(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/migracao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseUrl: customDbUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Migração para o Firebase concluída com sucesso!');
        setLastResult(data.results);
        await fetchStatus();
      } else {
        toast.error(data.error || 'Erro durante a migração');
      }
    } catch {
      toast.error('Erro ao conectar ao servidor para migração');
    } finally {
      setMigrating(false);
    }
  };

  const totalFirebaseDocs = status?.firebase?.counts
    ? Object.values(status.firebase.counts).reduce((a, b) => a + b, 0)
    : 0;

  const totalSupabaseDocs = status?.supabase?.counts
    ? Object.values(status.supabase.counts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Migração: Supabase → Firebase</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Transfira com segurança todos os condomínios, proprietários, faturas e lançamentos para o Google Cloud Firestore.
          </p>
        </div>
        <Button variant="outline" onClick={fetchStatus} disabled={loading || migrating} className="flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar Status
        </Button>
      </div>

      {/* Safety Notice Banner */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3 text-emerald-800 dark:text-emerald-200">
        <ShieldCheck className="h-5 w-5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="text-sm">
          <p className="font-semibold">Seus dados continuam 100% seguros no Supabase</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            O processo realiza apenas a <strong>leitura e cópia</strong> dos registros para o Firebase Firestore. Nada é alterado ou excluído da sua base de dados atual.
          </p>
        </div>
      </div>

      {/* Database Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Supabase Source */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5 text-emerald-600" />
                Origem: Supabase (PostgreSQL)
              </CardTitle>
              <Badge variant={status?.supabase.status === 'connected' ? 'default' : 'secondary'}>
                {status?.supabase.status === 'connected' ? 'Conectado' : 'Aguardando Conexão'}
              </Badge>
            </div>
            <CardDescription>Banco de dados PostgreSQL relacional atual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm">
              <div className="text-muted-foreground text-xs uppercase font-medium">Total de Registros Localizados</div>
              <div className="text-2xl font-bold mt-1">{totalSupabaseDocs}</div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="customDbUrl" className="text-xs text-muted-foreground">
                URL de Conexão do Supabase (Opcional se já estiver no .env)
              </Label>
              <Input
                id="customDbUrl"
                placeholder="postgresql://postgres:senha@aws-0-...pooler.supabase.com:6543/postgres"
                type="password"
                value={customDbUrl}
                onChange={(e) => setCustomDbUrl(e.target.value)}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Caso sua variável DATABASE_URL não esteja ativa, cole a Connection String direta do Supabase aqui.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Firebase Target */}
        <Card className="border-amber-500/30 bg-amber-500/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Flame className="h-5 w-5 text-amber-500" />
                Destino: Google Cloud Firebase (Firestore)
              </CardTitle>
              <Badge className="bg-amber-600 hover:bg-amber-700 text-white">
                Provisionado
              </Badge>
            </div>
            <CardDescription>Cloud Firestore Provisionado para o aplicativo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm">
              <div className="text-muted-foreground text-xs uppercase font-medium">Documentos Gravados no Firestore</div>
              <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{totalFirebaseDocs}</div>
            </div>

            <div className="text-xs space-y-1.5 pt-2 border-t font-mono bg-muted/40 p-2.5 rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Projeto:</span>
                <span className="font-semibold text-foreground">{status?.firebase.projectId || 'gen-lang-client-0853638886'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Banco Firestore:</span>
                <span className="font-semibold text-foreground">ai-studio-remixadmcondomin-...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status Regras:</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Deployed
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Migration Action Button */}
      <Card className="bg-slate-900 text-slate-50 border-slate-800">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Executar Transferência de Dados</h3>
            <p className="text-slate-400 text-sm">
              Copia todas as tabelas e dados para o Firestore de forma atômica e estruturada.
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleMigrate}
            disabled={migrating || loading}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shrink-0 flex items-center gap-2"
          >
            {migrating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Copiando Dados...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                Iniciar Migração para Firebase
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Data Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Espelhamento e Mapeamento de Dados</CardTitle>
          <CardDescription>
            Contagem de registros por entidade no Supabase e no Cloud Firestore
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tabela / Coleção</TableHead>
                <TableHead className="text-center">Supabase (PostgreSQL)</TableHead>
                <TableHead className="text-center">Firebase (Firestore)</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(COLLECTION_LABELS).map(([key, label]) => {
                const sbCount = status?.supabase?.counts?.[key] ?? 0;
                const fbCount = status?.firebase?.counts?.[key] ?? 0;
                const isSynced = fbCount > 0 && fbCount >= sbCount;

                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium">
                      <div>{label}</div>
                      <div className="text-xs text-muted-foreground font-mono">/{key}</div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{sbCount}</TableCell>
                    <TableCell className="text-center font-semibold text-amber-600 dark:text-amber-400">
                      {fbCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {isSynced ? (
                        <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                          Sincronizado
                        </Badge>
                      ) : fbCount > 0 ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-500">
                          {fbCount} copiados
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pendente</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
