import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSmtpConfig, saveSmtpConfig, SmtpConfig } from '@/lib/smtp-config';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const config = await getSmtpConfig(session.user.condominioId);
    
    if (!config) {
      return NextResponse.json({
        isConfigured: false,
        host: '',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        from: '',
      });
    }

    return NextResponse.json({
      isConfigured: true,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      // Mask password for security: show bullet indicator if set
      pass: config.pass ? '••••••••••••••••' : '',
      from: config.from,
      updatedAt: config.updatedAt,
    });
  } catch (error: any) {
    console.error('Erro ao buscar configuração SMTP:', error);
    return NextResponse.json({ error: 'Erro ao carregar configurações de SMTP' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { host, port, secure, user, pass, from } = body;

    if (!host || !user) {
      return NextResponse.json({ error: 'Servidor (Host) e Usuário são obrigatórios.' }, { status: 400 });
    }

    // If password is blank or mask string, retain existing password
    let actualPass = pass;
    if (!actualPass || actualPass.includes('••••')) {
      const existing = await getSmtpConfig(session.user.condominioId);
      if (existing?.pass) {
        actualPass = existing.pass;
      } else {
        return NextResponse.json({ error: 'A senha de e-mail é obrigatória.' }, { status: 400 });
      }
    }

    const newConfig: SmtpConfig = {
      host: String(host).trim(),
      port: Number(port) || 587,
      secure: Boolean(secure),
      user: String(user).trim(),
      pass: String(actualPass).trim(),
      from: String(from || user).trim(),
    };

    await saveSmtpConfig(newConfig);

    return NextResponse.json({
      success: true,
      message: 'Configurações de SMTP salvas com sucesso!',
      isConfigured: true,
    });
  } catch (error: any) {
    console.error('Erro ao salvar configuração SMTP:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao salvar configurações de SMTP' }, { status: 500 });
  }
}
