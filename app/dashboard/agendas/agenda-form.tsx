"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AgendaServico } from "@prisma/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface AgendaFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: AgendaServico | null;
  condominioId: string;
}

export function AgendaForm({ isOpen, onClose, initialData, condominioId }: AgendaFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    data_agendamento: format(new Date(), "yyyy-MM-dd"),
    status: "AGENDADO",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        titulo: initialData.titulo,
        descricao: initialData.descricao || "",
        data_agendamento: format(new Date(initialData.data_agendamento), "yyyy-MM-dd"),
        status: initialData.status,
      });
    } else {
      setFormData({
        titulo: "",
        descricao: "",
        data_agendamento: format(new Date(), "yyyy-MM-dd"),
        status: "AGENDADO",
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isEditing = !!initialData;
      const url = isEditing ? `/api/agendas/${initialData.id}` : "/api/agendas";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          condominioId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao salvar o agendamento");
      }

      toast.success(isEditing ? "Agendamento atualizado" : "Agendamento criado");
      router.refresh();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              required
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ex: Manutenção da Piscina"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (Opcional)</Label>
            <Input
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Detalhes adicionais"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_agendamento">Data Agendada</Label>
            <Input
              id="data_agendamento"
              type="date"
              required
              min={initialData ? format(new Date(initialData.data_agendamento), "yyyy-MM-dd") < today ? format(new Date(initialData.data_agendamento), "yyyy-MM-dd") : today : today}
              value={formData.data_agendamento}
              onChange={(e) => setFormData({ ...formData, data_agendamento: e.target.value })}
            />
            <p className="text-xs text-gray-500">
              A data não pode ser inferior ao dia atual para novos agendamentos ou edições.
            </p>
          </div>

          {initialData && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as string })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AGENDADO">Agendado</SelectItem>
                  <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
