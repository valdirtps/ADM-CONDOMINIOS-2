'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { SindicoFormDialog } from './sindico-form-dialog';
import { UserCheck, Calendar, Clock, Edit } from 'lucide-react';

export function SindicoManager({ sindicos, proprietarios }: { sindicos: any[], proprietarios: any[] }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSindico, setEditingSindico] = useState<any>(null);

  const checkIsVigente = (sindico: any) => {
    if (!sindico.ativo) return false;
    if (!sindico.data_fim) return true;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dataFim = new Date(sindico.data_fim);
    // Assumindo que a data vem do banco. Convertendo para meia-noite local, cobrindo o dia
    const userTimezoneOffset = dataFim.getTimezoneOffset() * 60000;
    const finalDate = new Date(dataFim.getTime() + userTimezoneOffset);
    finalDate.setHours(23, 59, 59, 999);
    
    return finalDate >= today;
  };

  const activeSindico = sindicos.find(checkIsVigente);

  const handleEdit = (sindico: any) => {
    setEditingSindico(sindico);
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingSindico(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Síndicos</h1>
        <Button onClick={handleNew}>Novo Síndico</Button>
      </div>

      {activeSindico && (
        <Card className="border-green-200 shadow-sm bg-green-50/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-green-800 flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Síndico Atual (Vigente)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Nome / Empresa</p>
              <p className="font-semibold text-lg text-gray-900">
                {activeSindico.proprietario 
                  ? `Apto ${activeSindico.proprietario.apartamento} - ${activeSindico.proprietario.nome}`
                  : activeSindico.empresa_nome}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                <Calendar className="h-4 w-4" /> Período de Gestão
              </p>
              <p className="font-medium text-gray-900">
                {format(new Date(activeSindico.data_inicio), 'dd/MM/yyyy')} até {activeSindico.data_fim ? format(new Date(activeSindico.data_fim), 'dd/MM/yyyy') : 'Atual'}
              </p>
            </div>
            <div className="flex flex-col md:items-end justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Data de Cadastro
                </p>
                <p className="font-medium text-gray-900 text-right">{format(new Date(activeSindico.createdAt), 'dd/MM/yyyy HH:mm')}</p>
              </div>
              <Button variant="outline" size="sm" className="mt-4 md:mt-0" onClick={() => handleEdit(activeSindico)}>
                <Edit className="h-4 w-4 mr-2" /> Editar Atual
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Síndicos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Empresa</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sindicos.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.proprietario 
                      ? `Apto ${s.proprietario.apartamento} - ${s.proprietario.nome}`
                      : s.empresa_nome}
                  </TableCell>
                  <TableCell>{format(new Date(s.data_inicio), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{s.data_fim ? format(new Date(s.data_fim), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell>{format(new Date(s.createdAt), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    {checkIsVigente(s) ? (
                      <Badge className="bg-green-500">Vigente</Badge>
                    ) : (
                      <Badge variant="secondary">{s.ativo && s.data_fim ? 'Vencido' : 'Inativo'}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(s)}>Editar</Button>
                  </TableCell>
                </TableRow>
              ))}
              {sindicos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum síndico cadastrado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SindicoFormDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        sindico={editingSindico} 
        proprietarios={proprietarios} 
      />
    </div>
  );
}
