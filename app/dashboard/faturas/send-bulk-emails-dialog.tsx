'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Mailbox, AlertTriangle, CheckCircle2, Settings, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';

export function SendBulkEmailsDialog({ meses }: { meses: string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedMes, setSelectedMes] = useState(meses[0] || '');
  const [smtpStatus, setSmtpStatus] = useState<{ isConfigured: boolean; user?: string } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoadingStatus(true);
      fetch('/api/configuracoes/smtp', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          setSmtpStatus({ isConfigured: Boolean(data.isConfigured), user: data.user });
        })
        .catch(() => {
          setSmtpStatus({ isConfigured: false });
        })
        .finally(() => setLoadingStatus(false));
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!selectedMes) return;
    setIsSending(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/faturas/enviar-email-lote', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ mes_ano: selectedMes })
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.isSimulado) {
          toast.warning(data.message, { duration: 10000 });
        } else {
          toast.success(data.message, { duration: 7000 });
        }
        setIsOpen(false);
      } else {
        toast.error(data.error || 'Erro ao enviar e-mails em lote.');
      }
    } catch (e) {
      toast.error('Ocorreu um erro inesperado ao conectar com o servidor.');
    } finally {
      setIsSending(false);
    }
  };

  if (meses.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button variant="secondary" className="gap-2" />}>
        <Mailbox className="h-4 w-4" />
        Enviar Lote por E-mail
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mailbox className="h-5 w-5 text-primary" />
            Enviar Faturas em Lote
          </DialogTitle>
          <DialogDescription>
            Selecione o mês de referência. O sistema gerará o PDF de cada fatura e enviará por e-mail 
            aos proprietários cadastrados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* SMTP Status Notice */}
          {!loadingStatus && smtpStatus && (
            smtpStatus.isConfigured ? (
              <Alert className="border-green-200 bg-green-50 text-green-900 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-xs font-semibold text-green-800">
                  Servidor SMTP Conectado ({smtpStatus.user})
                </AlertTitle>
                <AlertDescription className="text-xs text-green-700">
                  Os e-mails serão disparados diretamente para a caixa de entrada dos proprietários com o PDF em anexo.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-xs font-semibold text-amber-800 flex items-center justify-between">
                  <span>Modo Simulação (SMTP não configurado)</span>
                </AlertTitle>
                <AlertDescription className="text-xs text-amber-700 mt-1 space-y-2">
                  <p>
                    O sistema está em modo de simulação. Ao confirmar agora, nenhum e-mail real será entregue aos proprietários até que você configure o servidor SMTP.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-white text-amber-900 border-amber-300 hover:bg-amber-100 gap-1.5"
                    render={<Link href="/dashboard/configuracoes" />}
                    onClick={() => setIsOpen(false)}
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Configurar E-mail (SMTP) Agora
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </AlertDescription>
              </Alert>
            )
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Mês de Referência (Mês/Ano)</label>
            <select 
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={selectedMes}
              onChange={(e) => setSelectedMes(e.target.value)}
            >
              {meses.map(mes => (
                <option key={mes} value={mes}>{mes}</option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={isSending || !selectedMes}>
            {isSending ? 'Processando Envios...' : 'Confirmar Envios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
