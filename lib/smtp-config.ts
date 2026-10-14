import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  updatedAt?: string;
}

// In-memory cache for fast access
let cachedConfig: SmtpConfig | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds

/**
 * Retrieve SMTP configuration from Firestore, falling back to process.env and .env file
 */
export async function getSmtpConfig(condominioId?: string | null): Promise<SmtpConfig | null> {
  const now = Date.now();
  if (cachedConfig && (now - lastFetchTime) < CACHE_TTL_MS) {
    return cachedConfig;
  }

  // 1. Try Firestore
  try {
    const { getDocument } = await import('@/lib/firestore-service');
    // Check global SMTP config
    const docData = await getDocument<any>('configuracoes', 'smtp');
    if (docData && docData.host && docData.user && docData.pass) {
      const config: SmtpConfig = {
        host: String(docData.host).trim(),
        port: Number(docData.port) || 587,
        secure: Boolean(docData.secure),
        user: String(docData.user).trim(),
        pass: String(docData.pass).trim(),
        from: String(docData.from || docData.user).trim(),
        updatedAt: docData.updatedAt,
      };
      cachedConfig = config;
      lastFetchTime = now;
      return config;
    }
  } catch (err: any) {
    // Firestore lookup failed or not available yet
  }

  // 2. Try process.env
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const config: SmtpConfig = {
      host: process.env.SMTP_HOST.trim(),
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465' || process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER.trim(),
      pass: process.env.SMTP_PASS.trim(),
      from: (process.env.SMTP_FROM || process.env.SMTP_USER).trim(),
    };
    cachedConfig = config;
    lastFetchTime = now;
    return config;
  }

  // 3. Try reading local .env file if present
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      const parsed: Record<string, string> = {};
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const k = trimmed.substring(0, eqIdx).trim();
            let v = trimmed.substring(eqIdx + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
              v = v.slice(1, -1);
            }
            parsed[k] = v;
          }
        }
      }
      if (parsed.SMTP_HOST && parsed.SMTP_USER && parsed.SMTP_PASS) {
        const config: SmtpConfig = {
          host: parsed.SMTP_HOST.trim(),
          port: Number(parsed.SMTP_PORT) || 587,
          secure: parsed.SMTP_PORT === '465' || parsed.SMTP_SECURE === 'true',
          user: parsed.SMTP_USER.trim(),
          pass: parsed.SMTP_PASS.trim(),
          from: (parsed.SMTP_FROM || parsed.SMTP_USER).trim(),
        };
        cachedConfig = config;
        lastFetchTime = now;
        return config;
      }
    }
  } catch {}

  return null;
}

/**
 * Save SMTP configuration to Firestore and local .env
 */
export async function saveSmtpConfig(config: SmtpConfig): Promise<boolean> {
  const cleanConfig: SmtpConfig = {
    host: config.host.trim(),
    port: Number(config.port) || 587,
    secure: Boolean(config.secure),
    user: config.user.trim(),
    pass: config.pass.trim(),
    from: (config.from || config.user).trim(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Save to Firestore
  try {
    const { setDocument } = await import('@/lib/firestore-service');
    await setDocument('configuracoes', 'smtp', cleanConfig);
  } catch (err: any) {
    console.error('Error saving SMTP to Firestore:', err);
  }

  // 2. Update process.env so current process immediately picks it up
  process.env.SMTP_HOST = cleanConfig.host;
  process.env.SMTP_PORT = String(cleanConfig.port);
  process.env.SMTP_SECURE = String(cleanConfig.secure);
  process.env.SMTP_USER = cleanConfig.user;
  process.env.SMTP_PASS = cleanConfig.pass;
  process.env.SMTP_FROM = cleanConfig.from;

  // 3. Write / update local .env file
  try {
    const envPath = path.join(process.cwd(), '.env');
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
      // replace or append
      const keysToReplace = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
      let lines = content.split('\n').filter(line => {
        const trimmed = line.trim();
        return !keysToReplace.some(k => trimmed.startsWith(`${k}=`));
      });
      content = lines.join('\n').trim() + '\n\n';
    }

    content += `# SMTP Configuration (Saved from Dashboard)\n`;
    content += `SMTP_HOST="${cleanConfig.host}"\n`;
    content += `SMTP_PORT="${cleanConfig.port}"\n`;
    content += `SMTP_SECURE="${cleanConfig.secure}"\n`;
    content += `SMTP_USER="${cleanConfig.user}"\n`;
    content += `SMTP_PASS="${cleanConfig.pass}"\n`;
    content += `SMTP_FROM="${cleanConfig.from}"\n`;

    fs.writeFileSync(envPath, content, 'utf8');
  } catch (err: any) {
    console.warn('Could not write .env file:', err.message);
  }

  // Update in-memory cache
  cachedConfig = cleanConfig;
  lastFetchTime = Date.now();

  return true;
}

/**
 * Creates a Nodemailer transporter with connection timeout
 */
export function createSmtpTransporter(config: SmtpConfig): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

/**
 * Translates technical SMTP and Google Gmail error codes into clear Portuguese guidance
 */
export function formatSmtpErrorMessage(error: any): string {
  const msg = error?.message || String(error || '');
  if (
    msg.includes('534') ||
    msg.includes('Application-specific password required') ||
    msg.includes('InvalidSecondFactor') ||
    msg.includes('534-5.7.9')
  ) {
    return 'O Google Gmail exige uma "Senha de Aplicativo" de 16 letras. Sua senha normal da Conta Google foi recusada. Acesse myaccount.google.com/apppasswords, gere uma Senha de App e atualize em Configurações > E-mail (SMTP).';
  }
  if (
    error?.code === 'EAUTH' ||
    msg.includes('BadCredentials') ||
    msg.includes('Username and Password not accepted') ||
    msg.includes('Invalid login')
  ) {
    return 'Credenciais rejeitadas pelo provedor (usuário ou senha incorretos). Se estiver usando Gmail, certifique-se de usar uma "Senha de Aplicativo" de 16 letras gerada na Conta Google, e não a senha pessoal comum.';
  }
  if (error?.code === 'ESOCKET' || error?.code === 'ETIMEDOUT') {
    return 'Tempo limite esgotado ao conectar no servidor SMTP. Verifique o endereço do host e a porta (587 para TLS ou 465 para SSL).';
  }
  return msg;
}

/**
 * Verifies SMTP connection
 */
export async function verifySmtpConnection(config: SmtpConfig): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = createSmtpTransporter(config);
    await transporter.verify();
    return { success: true, message: 'Conexão com o servidor SMTP estabelecida com sucesso!' };
  } catch (error: any) {
    return { success: false, message: formatSmtpErrorMessage(error) };
  }
}

/**
 * Sends a test email
 */
export async function sendTestEmail(config: SmtpConfig, recipientEmail: string): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = createSmtpTransporter(config);
    const info = await transporter.sendMail({
      from: config.from || config.user,
      to: recipientEmail,
      subject: '✅ Teste de Configuração de E-mail - Sistema de Condomínio',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #16a34a; margin-top: 0;">🎉 Parabéns! Sua configuração de e-mail está funcionando!</h2>
          <p>Este é um e-mail de teste enviado automaticamente pelo <strong>Sistema de Gestão de Condomínio</strong>.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <p><strong>Detalhes da Conexão:</strong></p>
          <ul style="color: #475569; font-size: 14px; line-height: 1.6;">
            <li><strong>Servidor (Host):</strong> ${config.host}</li>
            <li><strong>Porta:</strong> ${config.port}</li>
            <li><strong>Remetente:</strong> ${config.from}</li>
            <li><strong>Data e Hora:</strong> ${new Date().toLocaleString('pt-BR')}</li>
          </ul>
          <div style="margin-top: 20px; padding: 12px; background-color: #f0fdf4; border-radius: 6px; color: #166534; font-size: 13px;">
            Agora você pode utilizar o envio de faturas individuais e o <strong>envio de faturas em lote</strong> com entrega garantida aos proprietários!
          </div>
        </div>
      `,
    });
    return { 
      success: true, 
      message: `E-mail de teste enviado com sucesso para ${recipientEmail}! (Message ID: ${info.messageId})` 
    };
  } catch (error: any) {
    return { success: false, message: formatSmtpErrorMessage(error) };
  }
}
