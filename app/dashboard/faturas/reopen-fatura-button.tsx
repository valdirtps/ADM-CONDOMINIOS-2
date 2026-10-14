'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function ReopenFaturaButton({ faturaId }: { faturaId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReopen = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/faturas/${faturaId}/reabrir`, {
        method: 'POST',
      });

      if (res.ok) {
        toast.success('Fatura reaberta com sucesso!');
        setOpen(false);
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao reabrir fatura');
      }
    } catch (err) {
      toast.error('Erro ao conectar ao servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" title="Reabrir Pagamento" className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700">
            <RotateCcw className="h-4 w-4 mr-1" />
            Reabrir
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reabrir Fatura?</DialogTitle>
          <DialogDescription>
            Esta ação irá remover o registro de pagamento desta fatura e retorná-la ao status PENDENTE. 
            Quaisquer ajustes automáticos criados para faturas futuras devido a este pagamento também serão removidos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleReopen} disabled={loading} className="bg-orange-600 hover:bg-orange-700">
            {loading ? 'Processando...' : 'Sim, Reabrir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
