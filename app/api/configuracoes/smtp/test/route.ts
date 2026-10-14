import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSmtpConfig, sendTestEmail, verifySmtpConnection, SmtpConfig } from '@/lib/smtp-config';

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { host, port, secure, user, pass, from, targetEmail } = body;

    let configToTest: SmtpConfig;

    if (host && user) {
      // Use config from form
      let actualPass = pass;
      if (!actualPass || actualPass.includes('••••')) {
        const existing = await getSmtpConfig(session.user.condominioId);
        actualPass = existing?.pass || '';
      }

      if (!actualPass) {
        return NextResponse.json({ error: 'Informe a senha para testar a conexão.' }, { status: 400 });
      }

      configToTest = {
        host: String(host).trim(),
        port: Number(port) || 587,
        secure: Boolean(secure),
        user: String(user).trim(),
        pass: String(actualPass).trim(),
        from: String(from || user).trim(),
      };
    } else {
      // Use saved config
      const saved = await getSmtpConfig(session.user.condominioId);
      if (!saved) {
        return NextResponse.json({ error: 'Nenhuma configuração de SMTP salva para testar.' }, { status: 400 });
      }
      configToTest = saved;
    }

    const recipient = targetEmail || session.user?.email || configToTest.user;
    if (!recipient || !recipient.includes('@')) {
      return NextResponse.json({ error: 'E-mail de destino inválido para o teste.' }, { status: 400 });
    }

    // 1. Verify connection first
    const verifyResult = await verifySmtpConnection(configToTest);
    if (!verifyResult.success) {
      return NextResponse.json({ 
        error: verifyResult.message,
        details: 'Falha na verificação com o servidor SMTP.'
      }, { status: 400 });
    }

    // 2. Send test email
    const sendResult = await sendTestEmail(configToTest, recipient);
    if (!sendResult.success) {
      return NextResponse.json({ 
        error: sendResult.message 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: sendResult.message,
    });
  } catch (error: any) {
    console.error('Erro no teste de SMTP:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao realizar teste de SMTP' }, { status: 500 });
  }
}
