import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Sistema de Gestão de Condomínios
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acesse sua conta para gerenciar seu condomínio (v1.0.1)
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
