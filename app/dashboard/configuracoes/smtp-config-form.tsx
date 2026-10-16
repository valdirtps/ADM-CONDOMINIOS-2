'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Send, 
  Save, 
  Mail, 
  HelpCircle, 
  RefreshCw,
  Server,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

interface SmtpFormData {
  isConfigured: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  updatedAt?: string;
}

export function SmtpConfigForm({ userEmail }: { userEmail?: string }) {
  const [formData, setFormData] = useState<SmtpFormData>({
    isConfigured: false,
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState(userEmail || '');
  const [showHelp, setShowHelp] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/configuracoes/smtp', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFormData({
          isConfigured: Boolean(data.isConfigured),
          host: data.host || '',
          port: data.port || 587,
          secure: Boolean(data.secure),
          user: data.user || '',
          pass: data.pass || '',
          from: data.from || '',
          updatedAt: data.updatedAt,
        });
        if (data.user) {
          setTestEmail(prev => prev || data.user);
        }
      }
    } catch (e) {
      toast.error('Erro ao carregar configurações de e-mail.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const applyPreset = (preset: 'gmail' | 'outlook' | 'yahoo' | 'zoho') => {
    if (preset === 'gmail') {
      setFormData(prev => ({
        ...prev,
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        from: prev.user ? `Condomínio <${prev.user}>` : prev.from,
      }));
      setShowHelp(true);
      toast.info('Configuração pré-definida para Gmail aplicada. Lembre-se de utilizar uma Senha de Aplicativo de 16 letras.');
    } else if (preset === 'outlook') {
      setFormData(prev => ({
        ...prev,
        host: 'smtp-mail.outlook.com',
        port: 587,
        secure: false,
        from: prev.user ? `Condomínio <${prev.user}>` : prev.from,
      }));
      toast.info('Configuração pré-definida para Outlook / Office 365 aplicada.');
    } else if (preset === 'yahoo') {
      setFormData(prev => ({
        ...prev,
        host: 'smtp.mail.yahoo.com',
        port: 465,
        secure: true,
        from: prev.user ? `Condomínio <${prev.user}>` : prev.from,
      }));
      toast.info('Configuração pré-definida para Yahoo Mail aplicada.');
    } else if (preset === 'zoho') {
      setFormData(prev => ({
        ...prev,
        host: 'smtp.zoho.com',
        port: 465,
        secure: true,
        from: prev.user ? `Condomínio <${prev.user}>` : prev.from,
      }));
      toast.info('Configuração pré-definida para Zoho Mail aplicada.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.host || !formData.user) {
      toast.error('Preencha pelo menos o Servidor (Host) e o Usuário/E-mail.');
      return;
    }

    setSaving(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/configuracoes/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Configurações de SMTP salvas com sucesso!');
        await loadConfig();
      } else {
        toast.error(data.error || 'Erro ao salvar configurações.');
      }
    } catch (e) {
      toast.error('Erro de conexão ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const target = testEmail || formData.user;
    if (!target || !target.includes('@')) {
      toast.error('Informe um e-mail válido para receber o teste.');
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/configuracoes/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          targetEmail: target,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestResult({ success: true, message: data.message });
        toast.success('E-mail de teste enviado com sucesso! Verifique sua caixa de entrada.');
      } else {
        setTestResult({ 
          success: false, 
          message: data.error || 'Falha ao autenticar ou enviar através do servidor SMTP.' 
        });
        toast.error(data.error || 'Falha no teste de envio.');
      }
    } catch (e) {
      setTestResult({ 
        success: false, 
        message: 'Erro ao comunicar com o servidor da aplicação.' 
      });
      toast.error('Erro inesperado durante o teste.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando configurações de e-mail...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {formData.isConfigured ? (
        <Alert className="border-green-200 bg-green-50 text-green-900">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertTitle className="font-semibold text-green-800 flex items-center gap-2">
            Servidor de E-mail (SMTP) Ativo e Conectado
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
              Pronto para Envio Real
            </Badge>
          </AlertTitle>
          <AlertDescription className="text-sm text-green-700 mt-1">
            O envio de faturas individuais e o <strong>envio de faturas em lote</strong> estão configurados para enviar mensagens reais aos proprietários através de <strong>{formData.user}</strong> ({formData.host}).
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertTitle className="font-semibold text-amber-800 flex items-center gap-2">
            Modo Simulação Ativo (SMTP não configurado)
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
              Simulação
            </Badge>
          </AlertTitle>
          <AlertDescription className="text-sm text-amber-700 mt-1">
            Como os dados de SMTP ainda não foram preenchidos, os disparos de e-mail (individuais ou em lote) funcionam apenas como <strong>simulação</strong> e nenhum e-mail real é entregue aos proprietários. Preencha os campos abaixo e clique em Salvar para ativar o envio real!
          </AlertDescription>
        </Alert>
      )}

      {/* Main Settings Form */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                Configurações do Servidor SMTP
              </CardTitle>
              <CardDescription>
                Informe os dados do seu provedor de e-mail para envio automático de faturas e comprovantes em PDF.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowHelp(!showHelp)}
              className="gap-1.5 self-start"
            >
              <HelpCircle className="h-4 w-4" />
              {showHelp ? 'Ocultar Ajuda Gmail' : 'Como Usar Gmail?'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Quick Presets */}
          <div className="mb-6 p-4 bg-muted/40 rounded-lg border">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">
              Preenchimento Rápido (Provedores Comuns):
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => applyPreset('gmail')}
                className="hover:bg-red-50 hover:text-red-700 hover:border-red-200"
              >
                Google Gmail
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => applyPreset('outlook')}
                className="hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
              >
                Outlook / Hotmail
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => applyPreset('yahoo')}
                className="hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200"
              >
                Yahoo Mail
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => applyPreset('zoho')}
              >
                Zoho Mail
              </Button>
            </div>
          </div>

          {/* Help Box for Gmail */}
          {(showHelp || formData.host.includes('gmail.com')) && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="font-semibold flex items-center gap-1.5 text-blue-800">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  Como resolver o erro do Gmail (Senha de Aplicativo de 16 letras)
                </div>
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors self-start"
                >
                  Abrir Gerador de Senhas de App no Google ↗
                </a>
              </div>
              
              <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded text-xs text-amber-900">
                <strong>Atenção:</strong> Se você recebeu o erro <code>534-5.7.9 Application-specific password required</code>, significa que você digitou sua senha pessoal comum. O Google desativou senhas normais para conexões SMTP e <strong>exige obrigatoriamente</strong> uma Senha de Aplicativo.
              </div>

              <div className="text-xs text-blue-800 space-y-1.5">
                <p className="font-medium">Passo a passo rápido:</p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>Certifique-se de que a <strong>Verificação em duas etapas</strong> está ativada na sua Conta Google.</li>
                  <li>Clique no botão azul acima ou acesse: <strong>myaccount.google.com/apppasswords</strong>.</li>
                  <li>Digite um nome no campo (ex: <code>Condomínio</code>) e clique no botão <strong>Criar</strong>.</li>
                  <li>O Google gerará uma senha de <strong>16 letras</strong> (exemplo: <code>abcd efgh ijkl mnop</code>).</li>
                  <li>Copie esse código de 16 letras e cole diretamente no campo <strong>Senha ou Senha de Aplicativo</strong> abaixo!</li>
                </ol>
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="host">Servidor SMTP (Host) *</Label>
                <Input
                  id="host"
                  placeholder="ex: smtp.gmail.com ou mail.seucodominio.com.br"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="port">Porta *</Label>
                <Input
                  id="port"
                  type="number"
                  placeholder="587 ou 465"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) || 587 })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user">Usuário / E-mail de Envio *</Label>
                <Input
                  id="user"
                  type="email"
                  placeholder="seu-email@gmail.com"
                  value={formData.user}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      user: val,
                      from: prev.from || `Condomínio <${val}>`
                    }));
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pass">Senha ou Senha de Aplicativo *</Label>
                <div className="relative">
                  <Input
                    id="pass"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={formData.isConfigured ? '•••••••••••••••• (deixe em branco para manter)' : 'Sua senha ou senha de app'}
                    value={formData.pass}
                    onChange={(e) => setFormData({ ...formData, pass: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="from">E-mail / Nome do Remetente (From)</Label>
              <Input
                id="from"
                placeholder='ex: "Condomínio Edifício Solar" <financeiro@condominio.com>'
                value={formData.from}
                onChange={(e) => setFormData({ ...formData, from: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Nome e endereço que aparecerão na caixa de entrada dos proprietários.
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="secure"
                checked={formData.secure}
                onChange={(e) => setFormData({ ...formData, secure: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="secure" className="text-sm font-normal cursor-pointer">
                Usar Conexão Segura SSL/TLS direta (geralmente marcada apenas para a porta 465)
              </Label>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar Configurações de SMTP'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Test Email Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Testar Conexão e Disparo de E-mail
          </CardTitle>
          <CardDescription>
            Envie uma mensagem de verificação instantânea para certificar-se de que os dados de conexão e senha estão 100% corretos antes de fazer o envio em lote.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="testEmail" className="text-xs">E-mail de Destino para o Teste</Label>
              <Input
                id="testEmail"
                type="email"
                placeholder="seu-email-pessoal@exemplo.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button 
                type="button" 
                variant="secondary" 
                onClick={handleTest} 
                disabled={testing || !formData.host || !formData.user}
                className="gap-2 w-full sm:w-auto"
              >
                <Send className="h-4 w-4" />
                {testing ? 'Testando e Enviando...' : 'Enviar E-mail de Teste'}
              </Button>
            </div>
          </div>

          {testResult && (
            <div className={`p-4 rounded-lg text-sm border mt-3 ${
              testResult.success 
                ? 'bg-green-50 border-green-200 text-green-900' 
                : 'bg-red-50 border-red-200 text-red-900'
            }`}>
              <div className="font-semibold flex items-center gap-1.5 mb-1">
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                {testResult.success ? 'Teste Concluído com Sucesso!' : 'Falha no Teste de Conexão'}
              </div>
              <p className="text-xs leading-relaxed">{testResult.message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
