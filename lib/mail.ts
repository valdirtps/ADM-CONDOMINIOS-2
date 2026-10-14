import { getSmtpConfig, createSmtpTransporter } from '@/lib/smtp-config';

export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const smtpConfig = await getSmtpConfig();
  if (!smtpConfig || !smtpConfig.user || !smtpConfig.pass) {
    console.log('--------------------------------------------------');
    console.log('SIMULAÇÃO DE E-MAIL (SMTP não configurado)');
    console.log(`Para: ${to}`);
    console.log(`Assunto: ${subject}`);
    console.log(`Conteúdo: ${html}`);
    console.log('--------------------------------------------------');
    return { success: true, simulated: true };
  }

  try {
    const transporter = createSmtpTransporter(smtpConfig);
    await transporter.sendMail({
      from: smtpConfig.from || smtpConfig.user,
      to,
      subject,
      html,
    });
    return { success: true, simulated: false };
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return { success: false, error };
  }
}
