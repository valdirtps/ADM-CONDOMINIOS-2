'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { formatCNPJ, formatCEP } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function EditCondominioForm({ condominio }: { condominio: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: condominio.nome,
    cnpj: condominio.cnpj,
    cep: condominio.cep,
    endereco: condominio.endereco,
    numero: condominio.numero || '',
    cidade: condominio.cidade,
    uf: condominio.uf,
    saldo_inicial: condominio.saldo_inicial,
    adminNome: condominio.usuarios?.[0]?.nome || '',
    adminEmail: condominio.usuarios?.[0]?.email || '',
  });

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedCep = formatCEP(e.target.value);
    setFormData({ ...formData, cep: formattedCep });

    if (formattedCep.length === 9) {
      try {
        const cleanCep = formattedCep.replace(/\D/g, '');
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            endereco: data.logradouro + (data.bairro ? ` - ${data.bairro}` : ''),
            cidade: data.localidade,
            uf: data.uf,
            cep: formattedCep
          }));
          toast.success('Endereço preenchido automaticamente');
        } else {
          toast.error('CEP não encontrado');
        }
      } catch (err) {
        console.error('Erro ao buscar CEP:', err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/condominios/${condominio.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success('Condomínio atualizado com sucesso!');
        router.push('/dashboard/condominios');
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao atualizar condomínio');
      }
    } catch (err) {
      toast.error('Erro ao conectar ao servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/condominios/${condominio.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Condomínio excluído com sucesso!');
        router.push('/dashboard/condominios');
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao excluir condomínio');
      }
    } catch (err) {
      toast.error('Erro ao conectar ao servidor');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" render={<Link href="/dashboard/condominios" />}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Editar Condomínio</h1>
        </div>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogTrigger render={
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Condomínio
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir Condomínio</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir este condomínio? Esta ação não pode ser desfeita.
                A exclusão só será permitida se não houver proprietários, faturas ou despesas vinculadas.
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Condomínio</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Condomínio *</Label>
                <Input id="nome" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ *</Label>
                <Input id="cnpj" required value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: formatCNPJ(e.target.value)})} maxLength={18} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" value={formData.cep} onChange={handleCepChange} maxLength={9} placeholder="00000-000" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input id="endereco" value={formData.endereco} onChange={e => setFormData({...formData, endereco: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero">Número</Label>
                <Input id="numero" value={formData.numero} onChange={e => setFormData({...formData, numero: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" value={formData.cidade} onChange={e => setFormData({...formData, cidade: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uf">UF</Label>
                <Input id="uf" maxLength={2} value={formData.uf} onChange={e => setFormData({...formData, uf: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saldo_inicial">Saldo Inicial (R$)</Label>
                <Input 
                  id="saldo_inicial" 
                  type="text" 
                  value={formData.saldo_inicial.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                  onChange={e => {
                    let value = e.target.value.replace(/\D/g, '');
                    if (value === '') value = '0';
                    const numericValue = parseInt(value, 10) / 100;
                    setFormData({...formData, saldo_inicial: numericValue});
                  }} 
                />
              </div>
            </div>

            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-medium mb-4">Dados do Administrador (Síndico)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="adminNome">Nome do Administrador *</Label>
                  <Input id="adminNome" required value={formData.adminNome} onChange={e => setFormData({...formData, adminNome: e.target.value})} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="adminEmail">E-mail de Acesso *</Label>
                  <Input id="adminEmail" type="email" required value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" render={<Link href="/dashboard/condominios" />}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
