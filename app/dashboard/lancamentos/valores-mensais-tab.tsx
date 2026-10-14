'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { safeSessionStorageGet, safeSessionStorageRemove } from '@/lib/storage';
import { format } from 'date-fns';
import { getActiveChamadasExtras } from '@/lib/chamadas-extras';
import { SindicoSecurityDialog } from '@/components/sindico-security-dialog';

export function ValoresMensaisTab({ 
  initialData, 
  allValoresMensais = [],
  defaultMesAno,
  chamadasExtras,
  parametros,
  sindico,
  proprietarios
}: { 
  initialData: any[], 
  allValoresMensais?: any[],
  defaultMesAno: string,
  chamadasExtras: any[],
  parametros: any[],
  sindico: any,
  proprietarios: any[]
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const defaultForm = {
    mes_ano: defaultMesAno,
    valor_agua: 0,
    valor_luz: 0,
    fundo_reserva: 0,
    taxa_condominio: 0,
    observacao: '',
  };

  const [formData, setFormData] = useState(defaultForm);

  // Security checking states
  const [securityOpen, setSecurityOpen] = useState(false);
  const [creatorSindicoId, setCreatorSindicoId] = useState('');
  const [creatorSindicoNome, setCreatorSindicoNome] = useState('');
  const [creatorSindicoEmail, setCreatorSindicoEmail] = useState('');
  const [pendingAction, setPendingAction] = useState<((code: string) => Promise<void>) | null>(null);

  // Calculate due date
  const getParametroForMesAno = (mesAno: string) => {
    const sorted = [...parametros].sort((a, b) => b.mes_ano.localeCompare(a.mes_ano));
    return sorted.find(p => p.mes_ano <= mesAno) || sorted[0];
  };
  const parametro = getParametroForMesAno(formData.mes_ano);
  
  let dueDateStr = '';
  if (parametro && formData.mes_ano) {
    const [year, month] = formData.mes_ano.split('-');
    dueDateStr = `${year}-${month}-${String(parametro.dia_vencimento).padStart(2, '0')}`;
  }

  // Calculate valor por apartamento
  let aptosPagantes = proprietarios.length;
  let isDividirMenosUm = parametro?.dividir_rateio_menos_um === true && proprietarios.length > 1;

  if (isDividirMenosUm) {
    aptosPagantes -= 1;
  } else if (sindico && sindico.proprietarioId && !sindico.paga_condominio) {
    aptosPagantes -= 1;
  }

  const aptosPagantesChamadaExtra = proprietarios.length - (sindico && sindico.proprietarioId && !sindico.paga_chamada_extra ? 1 : 0);
  
  const rateioAgua = formData.valor_agua / (aptosPagantes || 1);
  const rateioLuz = formData.valor_luz / (aptosPagantes || 1);
  
  let baseTaxaCondominio = formData.taxa_condominio;
  let baseFundoReserva = formData.fundo_reserva;

  const activeCE = getActiveChamadasExtras(chamadasExtras, formData.mes_ano);
  const rateioChamadasExtras = activeCE.reduce((sum, ce) => sum + (ce.valor / (aptosPagantesChamadaExtra || 1)), 0);

  const valorPorApartamento = Math.round((baseTaxaCondominio + baseFundoReserva + rateioAgua + rateioLuz + rateioChamadasExtras) * 100) / 100;


  const handleOpenNew = () => {
    // Determine previous month
    const [yearStr, monthStr] = defaultMesAno.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    const prevMesAno = `${year}-${String(month).padStart(2, '0')}`;

    const prevData = allValoresMensais.find(v => v.mes_ano === prevMesAno);
    const prevChamadaExtra = chamadasExtras.find(c => c.mes_ano === prevMesAno);

    let newForm = { ...defaultForm, mes_ano: defaultMesAno };

    if (prevData) {
      newForm.taxa_condominio = prevData.taxa_condominio || 0;
      newForm.fundo_reserva = prevData.fundo_reserva || 0;
      // Normal values like agua and luz might be reset, but to be helpful we can carry them, or leave as 0. 
      // Let's copy them so the user just edits if different.
      newForm.valor_agua = prevData.valor_agua || 0;
      newForm.valor_luz = prevData.valor_luz || 0;
    }

    setFormData(newForm);
    setOpen(true);
  };

  const handleEdit = (data: any) => {
    setFormData({
      mes_ano: data.mes_ano,
      valor_agua: data.valor_agua,
      valor_luz: data.valor_luz,
      fundo_reserva: data.fundo_reserva,
      taxa_condominio: data.taxa_condominio,
      observacao: data.observacao || '',
      sindicoId: data.sindicoId || null,
    } as any);
    setOpen(true);
  };

  const handleSubmit = async (e?: React.FormEvent, verificationCode?: string) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const parentSindicoId = (formData as any).sindicoId;
      const finalCode = verificationCode || (parentSindicoId ? safeSessionStorageGet(`sindico_code_${parentSindicoId}`) : null);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (finalCode) {
        headers['x-verification-code'] = finalCode;
      }

      const res = await fetch('/api/valores-mensais', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...formData,
          codigo_verificacao: finalCode,
        }),
      });

      if (res.ok) {
        toast.success('Valores mensais salvos com sucesso!');
        setOpen(false);
        router.refresh();
      } else if (res.status === 403 || res.status === 400) {
        const errorData = await res.json();
        if (errorData.codeRequired) {
          const sid = errorData.creatorSindicoId || (formData as any).sindicoId;
          if (sid) safeSessionStorageRemove(`sindico_code_${sid}`);
          
          setCreatorSindicoId(errorData.creatorSindicoId);
          setCreatorSindicoNome(errorData.creatorSindicoNome);
          setCreatorSindicoEmail(errorData.creatorSindicoEmail);
          setPendingAction(() => async (code: string) => {
            await handleSubmit(undefined, code);
          });
          setSecurityOpen(true);
        } else {
          toast.error(errorData.error || 'Erro de permissão');
        }
      } else {
        const data = await res.json();
        toast.error(data.details ? `${data.error}: ${data.details}` : (data.error || 'Erro ao salvar'));
      }
    } catch (err: any) {
      toast.error('Erro ao conectar ao servidor: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button onClick={handleOpenNew}>
          <Plus className="mr-2 h-4 w-4" /> Lançar Valores
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lançar Valores Mensais</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mes_ano">Mês/Ano (ex: 2026-03)</Label>
                  <Input id="mes_ano" type="month" required value={formData.mes_ano} onChange={e => setFormData({...formData, mes_ano: e.target.value})} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de Vencimento</Label>
                  <Input value={dueDateStr ? format(new Date(dueDateStr + 'T00:00:00'), 'dd/MM/yyyy') : ''} disabled className="bg-muted" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="taxa_condominio">Taxa de Condomínio (R$)</Label>
                  <Input 
                    id="taxa_condominio" 
                    type="text" 
                    required 
                    value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(formData.taxa_condominio)} 
                    onChange={e => {
                      let value = e.target.value.replace(/\D/g, '');
                      setFormData({...formData, taxa_condominio: Number(value) / 100});
                    }} 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fundo_reserva">Fundo de Reserva (R$)</Label>
                  <Input 
                    id="fundo_reserva" 
                    type="text" 
                    required 
                    value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(formData.fundo_reserva)} 
                    onChange={e => {
                      let value = e.target.value.replace(/\D/g, '');
                      setFormData({...formData, fundo_reserva: Number(value) / 100});
                    }} 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="valor_agua">Valor Total Água (R$)</Label>
                  <Input 
                    id="valor_agua" 
                    type="text" 
                    required 
                    value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(formData.valor_agua)} 
                    onChange={e => {
                      let value = e.target.value.replace(/\D/g, '');
                      setFormData({...formData, valor_agua: Number(value) / 100});
                    }} 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="valor_luz">Valor Total Luz (R$)</Label>
                  <Input 
                    id="valor_luz" 
                    type="text" 
                    required 
                    value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(formData.valor_luz)} 
                    onChange={e => {
                      let value = e.target.value.replace(/\D/g, '');
                      setFormData({...formData, valor_luz: Number(value) / 100});
                    }} 
                  />
                </div>
              </div>

              <div className="border-t pt-3">
                <h3 className="text-base font-medium mb-3">Observação Geral</h3>
                <div className="space-y-1.5">
                  <Input 
                    id="observacao" 
                    type="text" 
                    placeholder="Adicione uma observação geral que aparecerá em todas as faturas deste mês..."
                    value={formData.observacao} 
                    onChange={e => setFormData({...formData, observacao: e.target.value})} 
                  />
                </div>
              </div>

              <div className="bg-muted p-3 rounded-lg flex justify-between items-center mt-6">
                <span className="font-medium text-base">Valor a cobrar por apartamento (c/ Rateio de Chamadas Extras):</span>
                <span className="text-xl font-bold text-primary">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorPorApartamento)}
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Taxa Condomínio</TableHead>
                <TableHead className="text-right">Fundo Reserva</TableHead>
                <TableHead className="text-right">Água (Total)</TableHead>
                <TableHead className="text-right">Luz (Total)</TableHead>
                <TableHead className="text-right">Cham. Extra (Total)</TableHead>
                <TableHead className="text-right">Total a Cobrar</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialData.map((d) => {
                const param = getParametroForMesAno(d.mes_ano);
                let vencimentoStr = '-';
                if (param && d.mes_ano) {
                  const [year, month] = d.mes_ano.split('-');
                  vencimentoStr = format(new Date(`${year}-${month}-${String(param.dia_vencimento).padStart(2, '0')}T00:00:00`), 'dd/MM/yyyy');
                }

                const paramIsDiv = param?.dividir_rateio_menos_um === true && proprietarios.length > 1;
                let aptosPagantes = proprietarios.length;
                if (paramIsDiv) {
                  aptosPagantes -= 1;
                } else if (sindico && sindico.proprietarioId && !sindico.paga_condominio) {
                  aptosPagantes -= 1;
                }
                const aptosPagantesChamadaExtra = proprietarios.length - (sindico && sindico.proprietarioId && !sindico.paga_chamada_extra ? 1 : 0);
                
                const rateioAgua = d.valor_agua / (aptosPagantes || 1);
                const rateioLuz = d.valor_luz / (aptosPagantes || 1);
                
                const activeCE = getActiveChamadasExtras(chamadasExtras, d.mes_ano);
                const rateioChamadasExtras = activeCE.reduce((sum, ce) => sum + (ce.valor / (aptosPagantesChamadaExtra || 1)), 0);
                const totalChamadasExtras = activeCE.reduce((sum, ce) => sum + ce.valor, 0);
                
                const totalACobrar = Math.round((d.taxa_condominio + d.fundo_reserva + rateioAgua + rateioLuz + rateioChamadasExtras) * 100) / 100;

                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{vencimentoStr}</TableCell>
                    <TableCell className="text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.taxa_condominio)}</TableCell>
                    <TableCell className="text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.fundo_reserva)}</TableCell>
                    <TableCell className="text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.valor_agua)}</TableCell>
                    <TableCell className="text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.valor_luz)}</TableCell>
                    <TableCell className="text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalChamadasExtras)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalACobrar)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {initialData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-4">Nenhum valor mensal lançado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SindicoSecurityDialog
        open={securityOpen}
        onOpenChange={setSecurityOpen}
        creatorSindicoId={creatorSindicoId}
        creatorSindicoNome={creatorSindicoNome}
        creatorSindicoEmail={creatorSindicoEmail}
        onSuccess={(code) => {
          if (pendingAction) {
            pendingAction(code);
          }
        }}
      />
    </div>
  );
}
