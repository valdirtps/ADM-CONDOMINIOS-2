import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendMail } from '@/lib/mail';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { sindicoId } = await request.json();
    if (!sindicoId) {
      return NextResponse.json({ error: 'Síndico ID é obrigatório' }, { status: 400 });
    }

    const sindico = await prisma.sindico.findUnique({
      where: { id: sindicoId },
      include: { proprietario: true, condominio: true }
    });

    if (!sindico) {
      return NextResponse.json({ error: 'Síndico não cadastrado' }, { status: 404 });
    }

    // Generate a secure 6-digit code format
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Persist code on the creator sindico
    await prisma.sindico.update({
      where: { id: sindicoId },
      data: { codigo_verificacao: code }
    });

    const emailDestinatario = sindico.email_pessoal || (sindico.proprietario?.email) || "sindico@sistemacondominio.com";
    const nomeSindico = sindico.empresa_nome || (sindico.proprietario?.nome) || "Síndico Anterior";
    const nomeCondominio = sindico.condominio.nome;

    // Send the actual email
    const mailResult = await sendMail({
      to: emailDestinatario,
      subject: `Código de Segurança - ${nomeCondominio}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
          <h2 style="color: #1e293b;">Código de Segurança</h2>
          <p>Olá, <strong>${nomeSindico}</strong>.</p>
          <p>Uma solicitação de alteração/exclusão foi iniciada no condomínio <strong>${nomeCondominio}</strong> em um lançamento que você realizou originalmente.</p>
          <p>Para autorizar esta ação, forneça o código abaixo:</p>
          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border: 1px solid #e2e8f0;">
            ${code}
          </div>
          <p style="font-size: 14px; color: #64748b;">Se você não reconhece esta ação, ignore este e-mail.</p>
        </div>
      `
    });

    if (!mailResult.success) {
      console.error('Falha ao enviar e-mail de código:', mailResult.error);
      // Even if email fails, we might still return success in dev, but in production we should report it
      // For now, let's report it so the user knows why it "didn't send"
      return NextResponse.json({ 
        error: 'Falha ao enviar e-mail com o código. Verifique as configurações de SMTP.',
        details: mailResult.error
      }, { status: 500 });
    }

    console.log(`[EMAIL] Código de segurança ${code} enviado para ${emailDestinatario}`);

    return NextResponse.json({
      success: true,
      email: emailDestinatario,
      nome: nomeSindico,
      message: `Código enviado com sucesso para ${emailDestinatario}`
    });
  } catch (error) {
    console.error('Erro na solicitação de código de segurança:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
