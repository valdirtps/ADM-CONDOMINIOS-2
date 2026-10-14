'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function SindicoFormDialog({ open, onOpenChange, sindico, proprietarios }: { open: boolean, onOpenChange: (open: boolean) => void, sindico: any, proprietarios: any[] }) {
  const [formData, setFormData] = useState<{
    proprietarioId: string;
    empresa_nome: string;
    email_pessoal: string;
    data_inicio: string;
    data_fim: string;
    paga_condominio: boolean;
    paga_chamada_extra: boolean;
    ativo: boolean;
  }>({
    proprietarioId: 'none',
    empresa_nome: '',
    email_pessoal: '',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: '',
    paga_condominio: true,
    paga_chamada_extra: true,
    ativo: true,
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (sindico) {
      setFormData({
        proprietarioId: sindico.proprietarioId || 'none',
        empresa_nome: sindico.empresa_nome || '',
        email_pessoal: sindico.email_pessoal || '',
        data_inicio: sindico.data_inicio ? format(new Date(sindico.data_inicio), 'yyyy-MM-dd') : '',
        data_fim: sindico.data_fim ? format(new Date(sindico.data_fim), 'yyyy-MM-dd') : '',
        paga_condominio: sindico.paga_condominio ?? true,
        paga_chamada_extra: sindico.paga_chamada_extra ?? true,
        ativo: sindico.ativo ?? true,
      });
    } else {
      setFormData({
        proprietarioId: 'none',
        empresa_nome: '',
        email_pessoal: '',
        data_inicio: format(new Date(), 'yyyy-MM-dd'),
        data_fim: '',
        paga_condominio: true,
        paga_chamada_extra: true,
        ativo: true,
      });
    }
  }, [sindico, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = sindico ? `/api/sindico/${sindico.id}` : '/api/sindico';
      const method = sindico ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          proprietarioId: formData.proprietarioId === 'none' ? null : formData.proprietarioId,
        }),
      });

      if (res.ok) {
        toast.success(sindico ? 'Síndico atualizado com sucesso!' : 'Síndico cadastrado com sucesso!');
        onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{sindico ? 'Editar Síndico' : 'Novo Síndico'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="proprietarioId">Síndico é um Proprietário?</Label>
            <Select 
              value={formData.proprietarioId} 
              onValueChange={(value) => setFormData({ ...formData, proprietarioId: value || 'none' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um proprietário ou Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não (Empresa Terceirizada)</SelectItem>
                {proprietarios.map(p => (
                  <SelectItem key={p.id} value={p.id}>Apto {p.apartamento} - {p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.proprietarioId === 'none' && (
            <div className="space-y-2">
              <Label htmlFor="empresa_nome">Nome da Empresa / Síndico Profissional</Label>
              <Input
                id="empresa_nome"
                value={formData.empresa_nome}
                onChange={(e) => setFormData({ ...formData, empresa_nome: e.target.value })}
                required={formData.proprietarioId === 'none'}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email_pessoal">E-mail Pessoal (para recebimento de códigos de segurança)</Label>
            <Input
              id="email_pessoal"
              type="email"
              placeholder="sindico@exemplo.com"
              value={formData.email_pessoal}
              onChange={(e) => setFormData({ ...formData, email_pessoal: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_inicio">Data de Início</Label>
              <Input
                id="data_inicio"
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_fim">Data de Fim</Label>
              <Input
                id="data_fim"
                type="date"
                value={formData.data_fim}
                onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ativo">Status</Label>
            <Select 
              value={formData.ativo ? 'true' : 'false'} 
              onValueChange={(value) => setFormData({ ...formData, ativo: value === 'true' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Vigente (Ativo)</SelectItem>
                <SelectItem value="false">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Apenas um síndico pode estar vigente por vez. Ao ativar este, o atual será inativado.
            </p>
          </div>

          {formData.proprietarioId !== 'none' && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium">Isenções</h3>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="paga_condominio" 
                  checked={!formData.paga_condominio} 
                  onChange={(e) => setFormData({ ...formData, paga_condominio: !e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="paga_condominio">Isento da Taxa de Condomínio e Rateios</Label>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="paga_chamada_extra" 
                  checked={!formData.paga_chamada_extra} 
                  onChange={(e) => setFormData({ ...formData, paga_chamada_extra: !e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="paga_chamada_extra">Isento de Chamadas Extras</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
