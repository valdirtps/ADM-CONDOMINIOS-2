import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { generateFaturaPDFBuffer } from '@/lib/fatura-pdf';

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { mes_ano } = await req.json();
    if (!mes_ano) {
      return NextResponse.json({ error: 'Mês/Ano não informado' }, { status: 400 });
    }

    let faturas: any[] = [];

    // 1. Try Firebase Firestore
    try {
      const { listDocuments } = await import('@/lib/firestore-service');
      const [allFaturas, allProprietarios, allCondos] = await Promise.all([
        listDocuments<any>('faturas'),
        listDocuments<any>('proprietarios'),
        listDocuments<any>('condominios'),
      ]);

      if (allFaturas && allFaturas.length > 0) {
        const propMap = new Map((allProprietarios || []).map(p => [p.id, p]));
        const condoMap = new Map((allCondos || []).map(c => [c.id, c]));

        faturas = allFaturas
          .filter(f => (!session.user.condominioId || f.condominioId === session.user.condominioId) && f.mes_ano === mes_ano)
          .map(f => ({
            ...f,
            proprietario: f.proprietario || propMap.get(f.proprietarioId),
            condominio: f.condominio || condoMap.get(f.condominioId) || { nome: 'Condomínio', sindicos: [] },
          }))
          .filter(f => f.proprietario && f.proprietario.email && typeof f.proprietario.email === 'string' && f.proprietario.email.includes('@'));
      }
    } catch (fbErr: any) {
      console.warn('Firestore lookup warning in enviar-email-lote:', fbErr.message);
    }

    // 2. Fallback to Prisma
    if (faturas.length === 0) {
      try {
        faturas = await prisma.fatura.findMany({
          where: { 
            condominioId: session.user.condominioId || undefined,
            mes_ano: mes_ano,
            proprietario: {
              email: { not: null, notIn: [''] }
            }
          },
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

    if (faturas.length === 0) {
      return NextResponse.json({ error: 'Nenhum proprietário com e-mail cadastrado foi encontrado para as faturas deste mês.' }, { status: 404 });
    }

    const { getSmtpConfig, createSmtpTransporter, formatSmtpErrorMessage } = await import('@/lib/smtp-config');
    const smtpConfig = await getSmtpConfig(session.user.condominioId);
    const hasSmtpConfig = !!(smtpConfig && smtpConfig.host && smtpConfig.user && smtpConfig.pass);
    let transporter: nodemailer.Transporter | null = null;

    if (hasSmtpConfig && smtpConfig) {
      transporter = createSmtpTransporter(smtpConfig);
    }

    let sentCount = 0;
    const errorsList: string[] = [];

    for (const fatura of faturas) {
      const email = fatura.proprietario?.email;
      if (!email) continue;

      if (!hasSmtpConfig) {
        console.log(`[SIMULAÇÃO EM LOTE] E-mail que seria enviado para ${email} referente à fatura ${fatura.mes_ano}`);
        sentCount++;
        continue;
      }

      try {
        if (transporter && email && smtpConfig) {
          const pdfBuffer = await generateFaturaPDFBuffer(fatura);
          const condoNome = fatura.condominio?.nome || 'Condomínio';
          const aptoStr = fatura.proprietario?.apartamento || '-';
          const propNome = fatura.proprietario?.nome || 'Proprietário';
          const valorFormatado = (Number(fatura.valor_total) || 0).toFixed(2).replace('.', ',');
          const dataVencFormatada = (() => {
            try {
              const d = new Date(fatura.data_vencimento);
              if (isNaN(d.getTime())) return '-';
              return new Date(d.getTime() + new Date().getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
            } catch {
              return '-';
            }
          })();

          await transporter.sendMail({
            from: `"${condoNome}" <${smtpConfig.from || smtpConfig.user}>`,
            to: email,
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
          sentCount++;
        }
      } catch (e: any) {
        console.error(`Erro ao gerar/enviar para ${email}:`, e);
        errorsList.push(formatSmtpErrorMessage(e));
      }
    }

    if (!hasSmtpConfig) {
      return NextResponse.json({ 
        message: `Envio concluído em MODO SIMULAÇÃO (${sentCount} faturas processadas). Nenhum e-mail real foi enviado porque as credenciais de SMTP não foram configuradas. Acesse Configurações > E-mail (SMTP) para ativar o envio real.`,
        isSimulado: true,
        sentCount,
      });
    }

    if (errorsList.length > 0 && sentCount === 0) {
      return NextResponse.json({
        error: `Falha ao enviar e-mails: ${errorsList[0]}`,
        isSimulado: false,
        sentCount: 0,
      }, { status: 400 });
    }

    return NextResponse.json({ 
      message: `Lote processado com sucesso! ${sentCount} e-mails reais (com PDF em anexo) foram enviados aos proprietários.${errorsList.length > 0 ? ` (${errorsList.length} falhas)` : ''}`,
      isSimulado: false,
      sentCount,
    });
  } catch (error: any) {
    console.error('Erro ao enviar e-mail em lote:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao processar o envio em lote' }, { status: 500 });
  }
}
