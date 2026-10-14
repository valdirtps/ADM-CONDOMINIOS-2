"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

export function ProprietarioForm({ initialData }: { initialData?: any }) {
  const [formData, setFormData] = useState({
    nome: initialData?.nome || "",
    apartamento: initialData?.apartamento || "",
    telefone: initialData?.telefone || "",
    email: initialData?.email || "",
    saldo_devedor_inicial: initialData?.saldo_devedor_inicial || 0,
    mudancaProprietario: false,
  });
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = initialData
        ? `/api/proprietarios/${initialData.id}`
        : "/api/proprietarios";
      const method = initialData ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(
          initialData ? "Atualizado com sucesso!" : "Criado com sucesso!",
        );
        router.push("/dashboard/proprietarios");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro ao salvar");
      }
    } catch (err) {
      toast.error("Erro ao conectar ao servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/proprietarios/${initialData.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Excluído com sucesso!");
        router.push("/dashboard/proprietarios");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro ao excluir");
      }
    } catch (err) {
      toast.error("Erro ao conectar ao servidor");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apartamento">Apartamento *</Label>
              <Input
                id="apartamento"
                value={formData.apartamento}
                onChange={(e) =>
                  setFormData({ ...formData, apartamento: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) =>
                  setFormData({ ...formData, telefone: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="saldo">Saldo Devedor Inicial (R$)</Label>
              <Input
                id="saldo"
                type="text"
                value={formData.saldo_devedor_inicial.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '');
                  if (value === '') value = '0';
                  const numericValue = parseInt(value, 10) / 100;
                  setFormData({
                    ...formData,
                    saldo_devedor_inicial: numericValue,
                  });
                }}
              />
              <p className="text-xs text-muted-foreground">
                Aplicado apenas na primeira fatura gerada para este imóvel.
              </p>
            </div>

            {initialData && (
              <div className="flex items-start space-x-3 rounded-lg border p-4 shadow-sm bg-muted/40">
                <input
                  id="mudancaProprietario"
                  type="checkbox"
                  checked={formData.mudancaProprietario}
                  onChange={(e) =>
                    setFormData({ ...formData, mudancaProprietario: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <div className="space-y-1">
                  <Label htmlFor="mudancaProprietario" className="text-sm font-medium leading-none cursor-pointer">
                    Mudança de Proprietário? (&quot;Transferência&quot;)
                  </Label>
                  <p className="text-xs text-muted-foreground leading-normal mt-1">
                    Marque esta opção somente se este apartamento estiver trocando de morador. O proprietário antigo será congelado no histórico de faturas e um novo morador ativo será criado na lista de apartamentos.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <div>
            {initialData && (
              <Dialog>
                <DialogTrigger
                  render={<Button variant="destructive" type="button" />}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Excluir Proprietário</DialogTitle>
                    <DialogDescription>
                      Tem certeza que deseja excluir este proprietário? Esta
                      ação não pode ser desfeita.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose
                      render={<Button variant="outline" type="button" />}
                    >
                      Cancelar
                    </DialogClose>
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete()}
                      disabled={deleteLoading}
                    >
                      {deleteLoading ? "Excluindo..." : "Confirmar Exclusão"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.back()}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
