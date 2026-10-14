'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function PagarFaturaForm({ fatura }: { fatura: any }) {
  const [formData, setFormData] = useState({
    data_pagamento: format(new Date(), 'yyyy-MM-dd'),
    valor_pago: fatura.valor_total,
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/faturas/${fatura.id}/pagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_pagamento: new Date(formData.data_pagamento).toISOString(),
          valor_pago: formData.valor_pago,
        }),
      });

      if (res.ok) {
        toast.success('Pagamento registrado com sucesso!');
        router.push('/dashboard/faturas');
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao registrar pagamento');
      }
    } catch (err) {
      toast.error('Erro ao conectar ao servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fatura {fatura.mes_ano} - Apto {fatura.proprietario.apartamento}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Original</Label>
              <div className="text-lg font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fatura.valor_total)}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <div className="text-lg">
                {format(new Date(fatura.data_vencimento), 'dd/MM/yyyy')}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="data_pagamento">Data do Pagamento</Label>
              <Input
                id="data_pagamento"
                type="date"
                value={formData.data_pagamento}
                onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_pago">Valor Pago (R$)</Label>
              <Input
                id="valor_pago"
                type="number"
                step="0.01"
                value={formData.valor_pago}
                onChange={(e) => setFormData({ ...formData, valor_pago: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Registrando...' : 'Registrar Pagamento'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
