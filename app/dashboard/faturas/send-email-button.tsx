'use client';

import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function SendEmailButton({ faturaId, email, disabled = false }: { faturaId: string; email: string | null; disabled?: boolean }) {
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!email) return;
    setIsSending(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/faturas/${faturaId}/enviar-email`, {
        method: 'POST',
        credentials: 'include',
        headers,
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.isSimulado) {
          toast.warning(data.message || 'Modo Simulação: configure o servidor SMTP para entrega real.', { duration: 8000 });
        } else {
          toast.success(data.message || 'E-mail enviado com sucesso!');
        }
      } else {
        toast.error(data.error || 'Erro ao enviar e-mail');
      }
    } catch (e) {
      toast.error('Ocorreu um erro inesperado');
    } finally {
      setIsSending(false);
    }
  };

  if (!email) {
    return (
      <Button variant="ghost" size="sm" title="Proprietário sem e-mail cadastrado" disabled>
        <Mail className="h-4 w-4 text-gray-300" />
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSend} disabled={isSending || disabled} title={`Enviar para: ${email}`}>
      <Mail className="h-4 w-4 mr-1" />
      {isSending ? '...' : ''}
    </Button>
  );
}
