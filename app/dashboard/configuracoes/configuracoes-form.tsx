'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Lock, X } from 'lucide-react';
import { toast } from 'sonner';

export function ConfiguracoesForm({ initialData }: { initialData: any[] }) {
  console.log('ConfiguracoesForm initialData:', initialData);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const [mesAno, setMesAno] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const defaultForm = {
    mes_ano: '',
    dia_vencimento: 10,
    dias_isencao_multa: 5,
    multa_percentual: 2.0,
    dividir_rateio_menos_um: false,
  };

  const [formData, setFormData] = useState(defaultForm);

  const handleOpenNew = () => {
    setFormData({ ...defaultForm, mes_ano: mesAno });
    setEditingId(null);
    setOpen(true);
  };

  const handleEdit = (param: any) => {
    setFormData({
      mes_ano: param.mes_ano,
      dia_vencimento: param.dia_vencimento,
      dias_isencao_multa: param.dias_isencao_multa,
      multa_percentual: param.multa_percentual,
      dividir_rateio_menos_um: param.dividir_rateio_menos_um || false,
    });
    setEditingId(param.id);
    setOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    
    try {
      const res = await fetch(`/api/configuracoes/${deleteId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Configuração excluída com sucesso!');
        setDeleteId(null);
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao excluir');
      }
    } catch (err) {
      toast.error('Erro ao conectar ao servidor');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, id: editingId }),
      });

      if (res.ok) {
        toast.success('Configurações salvas com sucesso!');
        setOpen(false);
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao salvar');
      }
    } catch (err) {
      toast.error('Erro ao conectar ao servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleOpenNew}>
          <Plus className="mr-2 h-4 w-4" /> Nova Configuração
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Configuração' : 'Adicionar Configuração'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mes_ano">A partir de (Mês/Ano)</Label>
                <Input
                  id="mes_ano"
                  type="month"
                  value={formData.mes_ano}
                  onChange={(e) => setFormData({ ...formData, mes_ano: e.target.value })}
                  required
                  disabled={!!editingId}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dia_vencimento">Dia de Vencimento</Label>
                  <Input
                    id="dia_vencimento"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dia_vencimento}
                    onChange={(e) => setFormData({ ...formData, dia_vencimento: parseInt(e.target.value) || 1 })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dias_isencao_multa">Dias Isenção Multa</Label>
                  <Input
                    id="dias_isencao_multa"
                    type="number"
                    min="0"
                    value={formData.dias_isencao_multa}
                    onChange={(e) => setFormData({ ...formData, dias_isencao_multa: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="multa_percentual">Multa Mês (%)</Label>
                <Input
                  id="multa_percentual"
                  type="number"
                  step="0.01"
                  value={formData.multa_percentual}
                  onChange={(e) => setFormData({ ...formData, multa_percentual: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="dividir_rateio_menos_um"
                  checked={formData.dividir_rateio_menos_um}
                  onChange={(e) => setFormData({ ...formData, dividir_rateio_menos_um: e.target.checked })}
                  className="rounded border-gray-300 text-primary shadow-sm focus:border-primary focus:ring-primary h-4 w-4"
                />
                <Label htmlFor="dividir_rateio_menos_um" className="font-normal cursor-pointer">
                  Dividir rateio por Total de Apartamentos - 1 (Cota Extra Síndico)
                </Label>
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar Configuração'}
                </Button>
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
                <TableHead>A partir de</TableHead>
                <TableHead className="text-right">Dia Vencimento</TableHead>
                <TableHead className="text-right">Dias Isenção</TableHead>
                <TableHead className="text-right">Multa Mês (%)</TableHead>
                <TableHead className="text-center">Rateio (N-1)</TableHead>
                <TableHead className="w-[120px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialData.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.mes_ano}</TableCell>
                  <TableCell className="text-right">{p.dia_vencimento}</TableCell>
                  <TableCell className="text-right">{p.dias_isencao_multa}</TableCell>
                  <TableCell className="text-right">{p.multa_percentual}%</TableCell>
                  <TableCell className="text-center">{p.dividir_rateio_menos_um ? 'Sim' : 'Não'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {p.isLocked && <span title="Lançamentos vinculados"><Lock className="h-4 w-4 text-muted-foreground self-center" /></span>}
                      <Button variant="outline" size="sm" onClick={() => handleEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setDeleteId(p.id)} disabled={p.isLocked}>
                        <X className="h-4 w-4 mr-1" /> Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {initialData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nenhuma configuração encontrada.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!deleteId} onOpenChange={(isOpen) => !isOpen && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">Tem certeza que deseja excluir esta configuração? Esta ação não pode ser desfeita.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => confirmDelete()} disabled={isDeleting}>
              {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
