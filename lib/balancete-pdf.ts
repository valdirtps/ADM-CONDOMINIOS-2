import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generateBalancetePDFBuffer(
  condominio: any,
  mesAno: string,
  resumo: any,
  faturasPagas: any[],
  creditosExtras: any[],
  despesasDoMes: any[],
  faturasEmAtraso: any[],
  activeChamadasExtras: any[]
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 Size
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const colorBlack = rgb(0, 0, 0);
  const colorGray = rgb(0.3, 0.3, 0.3);
  const colorLightGray = rgb(0.8, 0.8, 0.8);
  const colorGreen = rgb(0.1, 0.5, 0.1);
  const colorRed = rgb(0.7, 0.1, 0.1);

  let currentY = height - 50;

  const addNewPageIfNeeded = (requiredSpace: number) => {
    if (currentY - requiredSpace < 50) {
      page = pdfDoc.addPage([595.28, 841.89]);
      currentY = height - 50;
    }
  };

  const moveDown = (pts = 15) => {
    currentY -= pts;
  };

  const drawText = (text: string, x: number, size: number, font: any, color: any = colorBlack, align: 'left' | 'center' | 'right' = 'left') => {
    if (!text) return;
    let finalX = x;
    if (align === 'right') {
      finalX = width - 50 - font.widthOfTextAtSize(text, size);
    } else if (align === 'center') {
      finalX = (width - font.widthOfTextAtSize(text, size)) / 2;
    }
    page.drawText(text, { x: finalX, y: currentY - size, size, font, color });
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDate = (dateInput: any) => {
    if (!dateInput) return '-';
    const d = new Date(new Date(dateInput).getTime() + new Date().getTimezoneOffset() * 60000);
    return d.toLocaleDateString('pt-BR');
  };

  const [year, month] = mesAno.split('-');

  // Header
  drawText(condominio.nome.toUpperCase(), 50, 16, fontBold, colorBlack, 'center');
  moveDown(20);
  drawText(`Balancete Mensal - ${month}/${year}`, 50, 12, fontRegular, colorGray, 'center');
  moveDown(30);

  // Resumo Financeiro e Inadimplência
  const startBoxesY = currentY;
  
  // Resumo Box
  page.drawRectangle({ x: 50, y: currentY - 90, width: (width / 2) - 60, height: 110, borderColor: colorBlack, borderWidth: 1 });
  currentY -= 15;
  drawText('Resumo Financeiro', 60, 11, fontBold);
  moveDown(20);
  drawText('Saldo Anterior:', 60, 10, fontRegular);
  drawText(formatCurrency(resumo.saldoAnterior), width / 2 - 20, 10, fontRegular, colorBlack, 'right');
  moveDown(15);
  drawText('Entradas do Mês:', 60, 10, fontRegular);
  drawText('+' + formatCurrency(resumo.totalEntradas), width / 2 - 20, 10, fontRegular, colorGreen, 'right');
  moveDown(15);
  drawText('Saídas do Mês:', 60, 10, fontRegular);
  drawText('-' + formatCurrency(resumo.totalSaidas), width / 2 - 20, 10, fontRegular, colorRed, 'right');
  moveDown(15);
  drawText('Saldo Atual:', 60, 11, fontBold);
  drawText(formatCurrency(resumo.saldoFinal), width / 2 - 20, 11, fontBold, colorBlack, 'right');

  currentY = startBoxesY;
  
  // Inadimplência Box
  page.drawRectangle({ x: width / 2 + 10, y: currentY - 90, width: (width / 2) - 60, height: 110, borderColor: colorBlack, borderWidth: 1 });
  currentY -= 15;
  drawText('Inadimplência (A receber)', width / 2 + 20, 11, fontBold);
  moveDown(20);
  
  let inadCount = 0;
  if (faturasEmAtraso.length === 0) {
    drawText('Nenhuma fatura em atraso.', width / 2 + 20, 9, fontRegular, colorGray);
  } else {
    for (const f of faturasEmAtraso) {
      if (inadCount > 3) {
        drawText('...', width / 2 + 20, 9, fontRegular);
        break; // Only show top 4
      }
      drawText(`Apto ${f.proprietario?.apartamento} (${formatDate(f.data_vencimento).substring(0,5)})`, width / 2 + 20, 9, fontRegular);
      drawText(formatCurrency(f.valor_total), width - 60, 9, fontRegular, colorRed, 'right');
      moveDown(15);
      inadCount++;
    }
  }

  currentY = startBoxesY - 110;
  moveDown(20);

  // Receitas (Entradas)
  addNewPageIfNeeded(60);
  drawText('RECEITAS (ENTRADAS)', 50, 12, fontBold);
  page.drawLine({ start: { x: 50, y: currentY - 15 }, end: { x: width - 50, y: currentY - 15 }, thickness: 1, color: colorBlack });
  moveDown(30);

  if (faturasPagas.length > 0) {
    addNewPageIfNeeded(40);
    drawText('Pagamento de Faturas', 50, 10, fontBold);
    moveDown(15);
    drawText('Apto', 50, 9, fontBold);
    drawText('Vencimento', 150, 9, fontBold);
    drawText('Pagamento', 250, 9, fontBold);
    drawText('Multa/Atraso', 420, 9, fontBold, colorBlack, 'right');
    drawText('Valor Pago', width - 50, 9, fontBold, colorBlack, 'right');
    moveDown(15);
    
    for (const f of faturasPagas) {
      addNewPageIfNeeded(20);
      const raw = f.raw;
      const multa = (raw.multa || 0) + (raw.juros || 0);
      drawText(f.desc, 50, 9, fontRegular);
      drawText(formatDate(raw.data_vencimento), 150, 9, fontRegular);
      drawText(formatDate(raw.data_pagamento), 250, 9, fontRegular);
      drawText(multa > 0 ? formatCurrency(multa) : '-', 420, 9, fontRegular, colorRed, 'right');
      drawText(formatCurrency(f.entrada), width - 50, 9, fontRegular, colorGreen, 'right');
      moveDown(15);
      page.drawLine({ start: { x: 50, y: currentY }, end: { x: width - 50, y: currentY }, thickness: 0.5, color: colorLightGray });
      moveDown(5);
    }
    moveDown(10);
  }

  if (creditosExtras.length > 0) {
    addNewPageIfNeeded(40);
    drawText('Outras Receitas e Créditos', 50, 10, fontBold);
    moveDown(15);
    drawText('Descrição', 50, 9, fontBold);
    drawText('Data', 350, 9, fontBold);
    drawText('Valor', width - 50, 9, fontBold, colorBlack, 'right');
    moveDown(15);
    
    for (const c of creditosExtras) {
      addNewPageIfNeeded(20);
      const raw = c.raw;
      drawText(c.desc, 50, 9, fontRegular);
      drawText(formatDate(raw.data_pagamento), 350, 9, fontRegular);
      drawText(formatCurrency(c.entrada), width - 50, 9, fontRegular, colorGreen, 'right');
      moveDown(15);
      page.drawLine({ start: { x: 50, y: currentY }, end: { x: width - 50, y: currentY }, thickness: 0.5, color: colorLightGray });
      moveDown(5);
    }
    moveDown(10);
  }

  if (faturasPagas.length === 0 && creditosExtras.length === 0) {
    drawText('Nenhuma receita registrada no mês.', 50, 9, fontRegular, colorGray);
    moveDown(20);
  }

  // Despesas (Saídas)
  addNewPageIfNeeded(60);
  drawText('DESPESAS (SAÍDAS)', 50, 12, fontBold);
  page.drawLine({ start: { x: 50, y: currentY - 15 }, end: { x: width - 50, y: currentY - 15 }, thickness: 1, color: colorBlack });
  moveDown(30);

  if (despesasDoMes.length > 0) {
    addNewPageIfNeeded(40);
    drawText('Despesa', 50, 9, fontBold);
    drawText('Detalhes', 200, 9, fontBold);
    drawText('Data Pgto', 400, 9, fontBold);
    drawText('Valor', width - 50, 9, fontBold, colorBlack, 'right');
    moveDown(15);
    
    for (const d of despesasDoMes) {
      addNewPageIfNeeded(25);
      const raw = d.raw;
      let desc = d.desc;
      if (desc.length > 30) desc = desc.substring(0, 27) + '...';
      
      let detalhes = raw.observacao || '-';
      if (detalhes.length > 35) detalhes = detalhes.substring(0, 32) + '...';
      
      drawText(desc, 50, 9, fontRegular);
      drawText(detalhes, 200, 9, fontRegular, colorGray);
      drawText(formatDate(raw.data_pagamento), 400, 9, fontRegular);
      drawText(formatCurrency(d.saida), width - 50, 9, fontRegular, colorRed, 'right');
      moveDown(15);
      page.drawLine({ start: { x: 50, y: currentY }, end: { x: width - 50, y: currentY }, thickness: 0.5, color: colorLightGray });
      moveDown(5);
    }
  } else {
    drawText('Nenhuma despesa registrada no mês.', 50, 9, fontRegular, colorGray);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
