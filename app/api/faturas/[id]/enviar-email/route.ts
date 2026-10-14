import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { generateFaturaPDFBuffer } from '@/lib/fatura-pdf';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const resolvedParams = await params;
    const faturaId = resolvedParams.id;

    let fatura: any = null;

    // 1. Try Firebase Firestore
    try {
      const { getDocument } = await import('@/lib/firestore-service');
      fatura = await getDocument<any>('faturas', faturaId);
      if (fatura) {
        if (fatura.proprietarioId && !fatura.proprietario) {
          fatura.proprietario = await getDocument<any>('proprietarios', fatura.proprietarioId) || {
            nome: 'Proprietário',
            apartamento: '-',
            email: '',
          };
        }
        if (fatura.condominioId && !fatura.condominio) {
          fatura.condominio = await getDocument<any>('condominios', fatura.condominioId) || {
            nome: 'Condomínio',
            sindicos: [],
          };
        }
      }
    } catch (fbErr: any) {
      console.warn('Firestore lookup error in enviar-email:', fbErr.message);
    }

    // 2. Fallback to Prisma
    if (!fatura) {
      try {
        fatura = await prisma.fatura.findUnique({
          where: { id: faturaId },
          include: {
            proprietario: true,
            condominio: {
              include: {
                sindicos: { where: { ativo: true }, include: { proprietario: true } }
              }
            }
          },
        });
      } catch (prismaErr: any) {
        // Prisma lookup failed
      }
    }

    if (!fatura || (session.user.condominioId && fatura.condominioId !== session.user.condominioId)) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
    }

    const emailDestinatario = fatura.proprietario?.email;
    if (!emailDestinatario || typeof emailDestinatario !== 'string' || !emailDestinatario.includes('@')) {
      return NextResponse.json({ error: 'Proprietário sem e-mail cadastrado ou e-mail inválido' }, { status: 400 });
    }

    const valorTotalNum = Number(fatura.valor_total) || 0;
    const valorFormatado = valorTotalNum.toFixed(2).replace('.', ',');
    const dataVencFormatada = (() => {
      try {
        const d = new Date(fatura.data_vencimento);
        if (isNaN(d.getTime())) return '-';
        return new Date(d.getTime() + new Date().getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
      } catch {
        return '-';
      }
    })();

    // Configure Nodemailer via getSmtpConfig
    const { getSmtpConfig, createSmtpTransporter } = await import('@/lib/smtp-config');
    const smtpConfig = await getSmtpConfig(session.user.condominioId);
    const hasSmtpConfig = !!(smtpConfig && smtpConfig.host && smtpConfig.user && smtpConfig.pass);

    if (!hasSmtpConfig) {
      // Test PDF generation to make sure everything works
      try {
        await generateFaturaPDFBuffer(fatura);
      } catch (pdfErr: any) {
        console.warn('PDF generation notice:', pdfErr?.message);
      }

      console.log(`[SIMULAÇÃO] E-mail que seria enviado para ${emailDestinatario} referente à fatura ${fatura.mes_ano}`);
      return NextResponse.json({ 
        message: `Modo Simulação: Nenhum e-mail real foi enviado para ${emailDestinatario} porque o SMTP não está configurado. Acesse Configurações > E-mail (SMTP) para cadastrar suas credenciais.`,
        isSimulado: true
      });
    }

    const transporter = createSmtpTransporter(smtpConfig!);

    try {
      // Generate the PDF Buffer
      const pdfBuffer = await generateFaturaPDFBuffer(fatura);

      const condoNome = fatura.condominio?.nome || 'Condomínio';
      const aptoStr = fatura.proprietario?.apartamento || '-';
      const propNome = fatura.proprietario?.nome || 'Proprietário';

      const info = await transporter.sendMail({
        from: `"${condoNome}" <${smtpConfig!.from || smtpConfig!.user}>`,
        to: emailDestinatario,
        subject: `Fatura de Condomínio - ${fatura.mes_ano} - ${condoNome}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1e293b; margin-top: 0;">Olá, ${propNome}</h2>
            <p>A fatura do condomínio <strong>${condoNome}</strong> referente ao mês <strong>${fatura.mes_ano}</strong> já está disponível.</p>
            
            <div style="background-color: #f8fafc; padding: 14px; border-radius: 6px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Apartamento:</strong> ${aptoStr}</p>
              <p style="margin: 4px 0;"><strong>Valor Total:</strong> R$ ${valorFormatado}</p>
              <p style="margin: 4px 0;"><strong>Vencimento:</strong> ${dataVencFormatada}</p>
            </div>
            
            <p>Segue em anexo o arquivo PDF com os detalhes completos da sua fatura e o código de barras / comprovante para pagamento.</p>
            
            <p style="color: #64748b; font-size: 13px; margin-top: 24px;">Se você já realizou o pagamento, por favor, desconsidere este e-mail.</p>
          </div>
        `,
        attachments: [
          {
            filename: `Fatura_${fatura.mes_ano}_Apto_${aptoStr}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          }
        ]
      });
      console.log('Mensagem enviada com sucesso:', info.messageId);
    } catch (smtpError: any) {
      console.error('Erro específico do SMTP ou PDF:', smtpError);
      const { formatSmtpErrorMessage } = await import('@/lib/smtp-config');
      return NextResponse.json({ 
        error: `Falha no envio de e-mail: ${formatSmtpErrorMessage(smtpError)}` 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      message: `Fatura com PDF em anexo enviada com sucesso para ${emailDestinatario}!`,
      isSimulado: false 
    });
  } catch (error: any) {
    console.error('Erro ao processar envio de e-mail:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao processar o envio' }, { status: 500 });
  }
}
