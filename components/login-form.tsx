'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        try {
          const data = await res.json();
          if (data.token && typeof window !== 'undefined') {
            localStorage.setItem('auth_token', data.token);
          }
        } catch {}
        window.location.replace('/dashboard');
      } else {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const jsonText = await res.text();
            const data = JSON.parse(jsonText);
            setError(data.error || 'Login falhou');
            toast.error(data.error || 'Login falhou');
          } catch (jsonErr) {
            console.error('Failed to parse JSON. Content-Type:', contentType, 'Status:', res.status);
            setError(`Erro na resposta do servidor: Resposta não é um JSON válido.`);
            toast.error(`Erro: Resposta inválida`);
          }
        } else {
          const text = await res.text();
          console.error('Non-JSON response:', text);
          setError(`Erro no servidor: ${res.status}`);
          toast.error(`Erro no servidor: ${res.status}`);
        }
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      const msg = err.message || String(err);
      setError(`Erro ao conectar ao servidor: ${msg}`);
      toast.error(`Erro ao conectar ao servidor: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Login</CardTitle>
        <CardDescription>
          Entre com seu e-mail e senha para acessar o sistema.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" className="text-left">
              <AlertDescription className="text-xs leading-relaxed space-y-2">
                <p>{error}</p>
                {error.includes('Supabase') && (
                  <div className="pt-2 border-t border-destructive/20">
                    <a
                      href="https://supabase.com/dashboard/project/luwzppwogjnktckkkuhl"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold hover:text-white"
                    >
                      Clique aqui para acessar o Painel do Supabase e reativar o projeto &rarr;
                    </a>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="bg-muted/50 p-3 rounded-lg border text-xs space-y-2">
            <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Acesso Rápido de Teste:</div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setEmail('valdirtps@gmail.com');
                  setPassword('admin123');
                }}
              >
                Preencher Administrador (Valdir)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setEmail('admin@sistema.com');
                  setPassword('admin123');
                }}
              >
                Preencher Admin Sistema
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
