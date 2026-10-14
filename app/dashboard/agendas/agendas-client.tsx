"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Pencil, Trash2, Calendar as CalendarIcon, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgendaForm } from "./agenda-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AgendaServico } from "@prisma/client";

interface AgendasClientProps {
  data: AgendaServico[];
  condominioId: string;
}

export function AgendasClient({ data, condominioId }: AgendasClientProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<AgendaServico | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  const handleEdit = (agenda: AgendaServico) => {
    setEditingAgenda(agenda);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/agendas/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Erro ao excluir agendamento");
      }

      toast.success("Agendamento excluído com sucesso");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Ocorreu um erro ao excluir");
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'AGENDADO': return 'bg-blue-100 text-blue-800';
      case 'CONCLUIDO': return 'bg-green-100 text-green-800';
      case 'CANCELADO': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditingAgenda(null); setIsFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Agendamento
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500 border rounded-lg bg-gray-50">
            Nenhum serviço agendado.
          </div>
        ) : (
          data.map((agenda) => (
            <div key={agenda.id} className="border rounded-lg p-5 shadow-sm bg-white flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-lg line-clamp-1" title={agenda.titulo}>
                  {agenda.titulo}
                </h3>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(agenda.status)}`}>
                  {agenda.status}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-4 flex-grow line-clamp-3">
                {agenda.descricao || "Sem descrição"}
              </p>
              
              <div className="flex items-center text-sm text-gray-500 mb-4">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(new Date(agenda.data_agendamento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </div>

              <div className="flex items-center gap-2 mt-auto pt-4 border-t">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(agenda)}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </Button>
                {deletingId === agenda.id ? (
                  <div className="flex items-center gap-1">
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(agenda.id)}>
                      Sim
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeletingId(null)}>
                      Não
                    </Button>
                  </div>
                ) : (
                  <Button variant="destructive" size="sm" onClick={() => setDeletingId(agenda.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <AgendaForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialData={editingAgenda}
        condominioId={condominioId}
      />
    </>
  );
}
