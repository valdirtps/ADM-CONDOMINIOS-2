import { ProprietarioForm } from './proprietario-form';

export default function NovoProprietarioPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Novo Proprietário</h1>
      <ProprietarioForm />
    </div>
  );
}
