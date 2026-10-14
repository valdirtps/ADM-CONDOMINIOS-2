'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function GerarFaturasDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mesAno, setMesAno] = useState('');
  const [showConfirmRecalcular, setShowConfirmRecalcular] = useState(false);
  const router = useRouter();

  const handleGerar = async (tipo_acao = 'gerar') => {
    if (!mesAno) {
      toast.error('Informe o mês de referência');
      return;
    }

    setLoading(true);
    setShowConfirmRecalcular(false);
    try {
      const res = await fetch('/api/faturas/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes_ano: mesAno, tipo_acao }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Faturas ${tipo_acao === 'recalcular' ? 'recalculadas' : 'geradas'} com sucesso! (${data.count} faturas)`);
        setOpen(false);
        router.refresh();
      } else {
        const data = await res.json();
        if (data.hasExisting) {
          setShowConfirmRecalcular(true);
        } else {
          toast.error(data.error || `Erro ao ${tipo_acao === 'recalcular' ? 'recalcular' : 'gerar'} faturas`);
        }
      }
    } catch (err) {
      toast.error('Erro ao conectar ao servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setShowConfirmRecalcular(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" /> Gerar Faturas
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{showConfirmRecalcular ? 'Recalcular Faturas' : 'Gerar Faturas do Mês'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!showConfirmRecalcular ? (
            <div className="space-y-2">
              <Label htmlFor="mes_ano">Mês de Referência</Label>
              <Input 
                id="mes_ano" 
                type="month" 
                value={mesAno} 
                onChange={(e) => setMesAno(e.target.value)} 
              />
              <p className="text-sm text-muted-foreground">
                Certifique-se de que os valores mensais (água, luz, taxa) já foram lançados para este mês.
              </p>
            </div>
          ) : (
            <div className="space-y-4 bg-orange-50 text-orange-800 p-4 rounded-md border border-orange-200">
              <p className="font-medium">Atenção!</p>
              <p className="text-sm">
                Já existem faturas geradas para <strong>{mesAno}</strong>. 
              </p>
              <p className="text-sm">
                Você pode recalcular as faturas para aplicar novos valores lançados. Apenas as faturas com status <strong>PENDENTE</strong> serão atualizadas. Faturas já pagas ou em atraso não serão modificadas.
              </p>
              <p className="text-sm font-semibold">Deseja recalcular e substituir as faturas pendentes?</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            {showConfirmRecalcular && (
              <Button variant="outline" onClick={() => setShowConfirmRecalcular(false)} disabled={loading}>
                Cancelar
              </Button>
            )}
            <Button 
              onClick={() => handleGerar(showConfirmRecalcular ? 'recalcular' : 'gerar')} 
              disabled={loading || !mesAno}
              variant={showConfirmRecalcular ? 'destructive' : 'default'}
            >
              {loading 
                ? (showConfirmRecalcular ? 'Recalculando...' : 'Gerando...') 
                : (showConfirmRecalcular ? 'Sim, Recalcular' : 'Gerar Faturas')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
