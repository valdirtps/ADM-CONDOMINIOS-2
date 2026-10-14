'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { safeSessionStorageGet, safeSessionStorageRemove } from '@/lib/storage';
import { toast } from 'sonner';
import { DialogFooter } from '@/components/ui/dialog';
import { SindicoSecurityDialog } from '@/components/sindico-security-dialog';

export function ValoresExclusivosTab({ 
  initialData, 
  defaultMesAno,
  proprietarios,
  parametros
}: { 
  initialData: any[], 
  defaultMesAno: string,
  proprietarios: any[],
  parametros: any[]
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Security checking states
  const [securityOpen, setSecurityOpen] = useState(false);
  const [creatorSindicoId, setCreatorSindicoId] = useState('');
  const [creatorSindicoNome, setCreatorSindicoNome] = useState('');
  const [creatorSindicoEmail, setCreatorSindicoEmail] = useState('');
  const [pendingAction, setPendingAction] = useState<((code: string) => Promise<void>) | null>(null);

  const [formData, setFormData] = useState({
    proprietarioId: '',
    tipo: 'debito',
    valor: '',
    descricao: ''
  });

  const handleSubmit = async (e?: React.FormEvent, verificationCode?: string) => {
    if (e) e.preventDefault();
    if (!formData.proprietarioId || !formData.valor || !formData.descricao) return;
    
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const parentSindicoId = (formData as any).sindicoId;
      const finalCode = verificationCode || (parentSindicoId ? safeSessionStorageGet(`sindico_code_${parentSindicoId}`) : null);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (finalCode) {
        headers['x-verification-code'] = finalCode;
      }

      const url = editId ? `/api/valores-individuais/${editId}` : '/api/valores-individuais';
      const method = editId ? 'PUT' : 'POST';

      const rawValor = parseFloat(formData.valor.toString().replace(',', '.'));
      const finalValor = formData.tipo === 'credito' ? -Math.abs(rawValor) : Math.abs(rawValor);

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          mes_ano: defaultMesAno,
          proprietarioId: formData.proprietarioId,
          valor: finalValor.toString(),
          descricao: formData.descricao,
          codigo_verificacao: finalCode,
        })
      });

      if (res.ok) {
        setFormData({
          proprietarioId: '',
          tipo: 'debito',
          valor: '',
          descricao: ''
        });
        setEditId(null);
        setIsOpen(false);
        router.refresh();
        toast.success(editId ? 'Atualizado com sucesso!' : 'Lançado com sucesso!');
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
          setErrorMsg(errorData.error || 'Erro de permissão');
        }
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Erro ao salvar. Tente novamente.');
      }
    } catch (error) {
      console.error(error);
      setErrorMsg('Erro inesperado ao salvar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (v: any) => {
    setEditId(v.id);
    setFormData({
      proprietarioId: v.proprietarioId,
      tipo: v.valor < 0 ? 'credito' : 'debito',
      valor: Math.abs(v.valor).toString(),
      descricao: v.descricao,
      sindicoId: v.sindicoId || null,
    } as any);
    setIsOpen(true);
  };

  const handleOpenNew = () => {
    setEditId(null);
    setFormData({
      proprietarioId: '',
      tipo: 'debito',
      valor: '',
      descricao: ''
    });
    setIsOpen(true);
  };

  const confirmDelete = async (verificationCode?: string) => {
    if (!deleteId) return;
    setIsDeleting(true);
    
    try {
      const originalItem = initialData.find(v => v.id === deleteId);
      const parentSindicoId = originalItem?.sindicoId;
      const finalCode = verificationCode || (parentSindicoId ? safeSessionStorageGet(`sindico_code_${parentSindicoId}`) : null);

      const headers: Record<string, string> = {};
      if (finalCode) {
        headers['x-verification-code'] = finalCode;
      }

      const url = `/api/valores-individuais/${deleteId}` + (finalCode ? `?codigo_verificacao=${finalCode}` : '');
      const res = await fetch(url, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        toast.success('Excluído com sucesso');
        setDeleteId(null);
        router.refresh();
      } else if (res.status === 403 || res.status === 400) {
        const errorData = await res.json();
        if (errorData.codeRequired) {
          const sid = errorData.creatorSindicoId || (initialData.find(v => v.id === deleteId)?.sindicoId);
          if (sid) safeSessionStorageRemove(`sindico_code_${sid}`);
          setCreatorSindicoId(errorData.creatorSindicoId);
          setCreatorSindicoNome(errorData.creatorSindicoNome);
          setCreatorSindicoEmail(errorData.creatorSindicoEmail);
          setPendingAction(() => async (code: string) => {
            await confirmDelete(code);
          });
          setSecurityOpen(true);
        } else {
          toast.error(errorData.error || 'Erro de permissão');
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao excluir.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro inesperado ao excluir.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Calculate actual due date conceptually
  const param = parametros.find(p => p.mes_ano <= defaultMesAno) || parametros[0];
  const dueDay = param ? param.dia_vencimento : 10;
  
  let dueDateStr = '';
  if (defaultMesAno && defaultMesAno.length === 7) {
    const [y, m] = defaultMesAno.split('-').map(Number);
    dueDateStr = format(new Date(y, m - 1, dueDay), 'dd/MM/yyyy');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Valores Exclusivos</h2>
          <p className="text-sm text-muted-foreground">Valores aplicados individualmente aos apartamentos (taxas, restituições)</p>
        </div>
        
        <Button onClick={handleOpenNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lançamento
        </Button>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) { setEditId(null); }
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editId ? 'Editar Valor Exclusivo' : 'Lançar Valor Exclusivo'}</DialogTitle>
              <DialogDescription>
                Lançamento no ciclo {defaultMesAno}. O valor constará diretamente na fatura deste condômino.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              {errorMsg && (
                <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-2 relative pb-2">
                <Label>Vencimento da Fatura</Label>
                <Input 
                  value={dueDateStr} 
                  disabled 
                  className="bg-muted text-muted-foreground"
                />
                <span className="text-[10px] text-muted-foreground absolute bottom-0 left-1">Data baseada nas configurações</span>
              </div>
              
              <div className="space-y-2">
                <Label>Apartamento</Label>
                <Select value={formData.proprietarioId} onValueChange={(val) => setFormData({...formData, proprietarioId: val || ''})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o condômino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {proprietarios.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        Apto {p.apartamento} - {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Lançamento</Label>
                <RadioGroup 
                  value={formData.tipo} 
                  onValueChange={(val) => setFormData({...formData, tipo: val})}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="debito" id="debito" />
                    <Label htmlFor="debito" className="font-normal text-muted-foreground">Débito (Cobrança extra na fatura)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="credito" id="credito" />
                    <Label htmlFor="credito" className="font-normal text-muted-foreground">Crédito (Desconto na fatura)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={formData.valor}
                  onChange={(e) => setFormData({...formData, valor: e.target.value})}
                  placeholder="Ex: 50.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Referente a</Label>
                <Input 
                  value={formData.descricao}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  placeholder="Ex: Restituição de taxa, Multa por barulho..."
                  required
                />
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="mr-2">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Salvar Lancamento'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este lançamento exclusivo? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmDelete()} disabled={isDeleting}>
              {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Lanç.</TableHead>
                <TableHead>Apto</TableHead>
                <TableHead>Referente a</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum valor exclusivo lançado para o ciclo {defaultMesAno}.
                  </TableCell>
                </TableRow>
              ) : (
                initialData.map((v) => {
                  const apto = v.proprietario?.apartamento || (proprietarios.find(p => p.id === v.proprietarioId)?.apartamento) || '-';
                  let dataStr = '-';
                  try {
                    if (v.createdAt) dataStr = format(new Date(v.createdAt), 'dd/MM/yyyy');
                  } catch {}

                  return (
                    <TableRow key={v.id}>
                      <TableCell>{dataStr}</TableCell>
                      <TableCell>Apto {apto}</TableCell>
                      <TableCell>
                        {v.descricao}
                        {v.valor < 0 && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Crédito</span>}
                        {v.valor > 0 && <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Débito</span>}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${v.valor < 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(v.valor))}
                      </TableCell>
                      <TableCell className="text-right flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(v)}>
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(v.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
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
