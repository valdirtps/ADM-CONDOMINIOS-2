'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { safeSessionStorageGet, safeSessionStorageRemove } from '@/lib/storage';
import { SindicoSecurityDialog } from '@/components/sindico-security-dialog';

export function CreditosExtrasTab({ initialData, defaultMesAno }: { initialData: any[], defaultMesAno: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creditToDelete, setCreditToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  // Security checking states
  const [securityOpen, setSecurityOpen] = useState(false);
  const [creatorSindicoId, setCreatorSindicoId] = useState('');
  const [creatorSindicoNome, setCreatorSindicoNome] = useState('');
  const [creatorSindicoEmail, setCreatorSindicoEmail] = useState('');
  const [pendingAction, setPendingAction] = useState<((code: string) => Promise<void>) | null>(null);

  const defaultForm = {
    valor: 0,
    referente: '',
    mes_ano: defaultMesAno,
    data_lancamento: new Date().toISOString().split('T')[0],
  };

  const [formData, setFormData] = useState(defaultForm);

  const handleOpenNew = () => {
    setFormData({ ...defaultForm, mes_ano: defaultMesAno, data_lancamento: new Date().toISOString().split('T')[0] });
    setEditingId(null);
    setOpen(true);
  };

  const handleEdit = (credit: any) => {
    setFormData({
      valor: credit.valor,
      referente: credit.referente,
      mes_ano: credit.mes_ano || defaultMesAno,
      data_lancamento: credit.data_lancamento ? new Date(credit.data_lancamento).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      sindicoId: credit.sindicoId || null,
    } as any);
    setEditingId(credit.id);
    setOpen(true);
  };

  const handleDelete = async (verificationCode?: string) => {
    if (!creditToDelete) return;
    setIsDeleting(true);
    try {
      const originalItem = initialData.find(c => c.id === creditToDelete);
      const parentSindicoId = originalItem?.sindicoId;
      const finalCode = verificationCode || (parentSindicoId ? safeSessionStorageGet(`sindico_code_${parentSindicoId}`) : null);

      const headers: Record<string, string> = {};
      if (finalCode) {
        headers['x-verification-code'] = finalCode;
      }

      const url = `/api/creditos-extras/${creditToDelete}` + (finalCode ? `?codigo_verificacao=${finalCode}` : '');
      const res = await fetch(url, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        toast.success('Crédito excluído com sucesso!');
        setDeleteDialogOpen(false);
        setCreditToDelete(null);
        router.refresh();
      } else if (res.status === 403 || res.status === 400) {
        const errorData = await res.json();
        if (errorData.codeRequired) {
          const sid = errorData.creatorSindicoId || (initialData.find(c => c.id === creditToDelete)?.sindicoId);
          if (sid) safeSessionStorageRemove(`sindico_code_${sid}`);
          setCreatorSindicoId(errorData.creatorSindicoId);
          setCreatorSindicoNome(errorData.creatorSindicoNome);
          setCreatorSindicoEmail(errorData.creatorSindicoEmail);
          setPendingAction(() => async (code: string) => {
            await handleDelete(code);
          });
          setSecurityOpen(true);
        } else {
          toast.error(errorData.error || 'Erro de permissão');
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao excluir crédito');
      }
    } catch (err) {
      toast.error('Erro ao conectar ao servidor');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (id: string) => {
    setCreditToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e?: React.FormEvent, verificationCode?: string) => {
    if (e) e.preventDefault();

    if (!formData.referente) {
      toast.error('Informe o campo texto referente');
      return;
    }
    if (formData.valor <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    setLoading(true);

    try {
      const parentSindicoId = (formData as any).sindicoId;
      const finalCode = verificationCode || (parentSindicoId ? safeSessionStorageGet(`sindico_code_${parentSindicoId}`) : null);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (finalCode) {
        headers['x-verification-code'] = finalCode;
      }

      const url = editingId ? `/api/creditos-extras/${editingId}` : '/api/creditos-extras';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          ...formData,
          data_lancamento: new Date(formData.data_lancamento).toISOString(),
          codigo_verificacao: finalCode,
        }),
      });

      if (res.ok) {
        toast.success(editingId ? 'Crédito atualizado com sucesso!' : 'Crédito adicionado com sucesso!');
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
        toast.error(data.error || 'Erro ao salvar');
      }
    } catch (err) {
      toast.error('Erro ao conectar ao servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button onClick={handleOpenNew}>
          <Plus className="mr-2 h-4 w-4" /> Novo Crédito Extra
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Crédito' : 'Adicionar Crédito'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mes_ano">Vencimento Selecionado</Label>
                <Input id="mes_ano" type="month" required value={formData.mes_ano} onChange={e => setFormData({...formData, mes_ano: e.target.value})} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="referente">Texto Referente</Label>
                <Input 
                   id="referente" 
                   type="text" 
                   required 
                   placeholder="Ex: Aluguel do Salão de Festas"
                   value={formData.referente} 
                   onChange={e => setFormData({...formData, referente: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$)</Label>
                <Input 
                  id="valor" 
                  type="text" 
                  required 
                  value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(formData.valor)} 
                  onChange={e => {
                    let value = e.target.value.replace(/\D/g, '');
                    setFormData({...formData, valor: Number(value) / 100});
                  }} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_lancamento">Data de Lançamento</Label>
                <Input id="data_lancamento" type="date" required value={formData.data_lancamento} onChange={e => setFormData({...formData, data_lancamento: e.target.value})} />
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Crédito</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este crédito? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => handleDelete()} disabled={isDeleting}>
              {isDeleting ? 'Excluindo...' : 'Sim, excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Referente</TableHead>
                <TableHead>Lançamento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialData.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.mes_ano}</TableCell>
                  <TableCell>{c.referente}</TableCell>
                  <TableCell>{c.data_lancamento ? format(new Date(c.data_lancamento), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell className="text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.valor)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" className="text-destructive hover:text-destructive" onClick={() => confirmDelete(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {initialData.length > 0 && (
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={3} className="text-right">Total:</TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      initialData.reduce((acc, curr) => acc + curr.valor, 0)
                    )}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
              {initialData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nenhum crédito lançado.</TableCell>
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
