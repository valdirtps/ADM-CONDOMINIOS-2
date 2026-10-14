import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generateFaturaPDFBuffer(fatura: any): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const colorBlack = rgb(0, 0, 0);
  const colorGray = rgb(0, 0, 0); // User requested all gray fonts to be black
  const colorLightGray = rgb(0.8, 0.8, 0.8);
  const colorOrange = rgb(0.7, 0.3, 0.1);
  const colorOrangeBg = rgb(1.0, 0.95, 0.85);

  let currentY = height - 50;
  const moveDown = (pts = 15) => { currentY -= pts; };

  const drawText = (text: string, x: number, size: number, font: any, color: any = colorBlack, align: 'left' | 'center' | 'right' = 'left') => {
    if (!text) return;
    let finalX = x;
    if (align === 'right') {
      finalX = width - 50 - font.widthOfTextAtSize(text, size);
    } else if (align === 'center') {
      finalX = (width - font.widthOfTextAtSize(text, size)) / 2;
    }
    
    // In pdf-lib, coordinate Y is from bottom to top. 
    page.drawText(text, { x: finalX, y: currentY - size, size, font, color });
  };

  const splitTextToLines = (text: string, font: any, size: number, maxWidth: number) => {
    if (!text) return [];
    const paragraphs = text.split('\n');
    const lines: string[] = [];
    for (const paragraph of paragraphs) {
      const words = paragraph.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine.length === 0 ? word : currentLine + ' ' + word;
        const testWidth = font.widthOfTextAtSize(testLine, size);
        if (testWidth > maxWidth) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);
    }
    return lines.filter(l => l.trim().length > 0);
  };

  let detalhes: any = {};
  try {
    detalhes = typeof fatura.detalhes === 'string' ? JSON.parse(fatura.detalhes || '{}') : (fatura.detalhes || {});
  } catch {
    detalhes = {};
  }
  const sindico = fatura.condominio?.sindicos?.[0];
  const nomeSindico = sindico?.proprietario ? `Apto ${sindico.proprietario.apartamento} - ${sindico.proprietario.nome}` : (sindico?.empresa_nome || 'Não definido');
  
  const formatCurrency = (val: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);
  const formatDate = (dateInput: any) => {
    if (!dateInput) return '';
    try {
      const d = new Date(new Date(dateInput).getTime() + new Date().getTimezoneOffset() * 60000);
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
    } catch {
      return '';
    }
  };

  // == HEADER ==
  drawText(fatura.condominio?.nome?.toUpperCase() || '', 50, 16, fontBold);
  moveDown(20);
  drawText(`${fatura.condominio?.endereco || ''}, ${fatura.condominio?.numero || 'S/N'} - ${fatura.condominio?.cidade || ''} - ${fatura.condominio?.uf || ''}`, 50, 10, fontRegular, colorGray);
  moveDown(12);
  drawText(`CNPJ: ${fatura.condominio?.cnpj || ''}`, 50, 10, fontRegular, colorGray);
  
  const headerY = currentY;

  currentY = height - 50;
  drawText('RECIBO DE CONDOMÍNIO', 0, 12, fontBold, colorBlack, 'right');
  moveDown(16);
  drawText(`Vencimento: ${formatDate(fatura.data_vencimento)}`, 0, 10, fontRegular, colorGray, 'right');
  moveDown(12);
  drawText(`Emissão: ${formatDate(fatura.createdAt || new Date())}`, 0, 10, fontRegular, colorGray, 'right');

  currentY = Math.min(currentY, headerY) - 15;

  page.drawLine({ start: { x: 50, y: currentY }, end: { x: width - 50, y: currentY }, thickness: 1, color: colorBlack });
  moveDown(15);

  drawText(`Síndico: ${nomeSindico}`, 50, 10, fontRegular);
  moveDown(25);

  // == PROPRIETÁRIO ==
  drawText('Detalhes da Fatura', 50, 12, fontBold);
  moveDown(15);
  
  drawText('Proprietário', 50, 10, fontRegular, colorGray);
  drawText('Apartamento', 0, 10, fontRegular, colorGray, 'right');
  moveDown(12);
  
  drawText(fatura.proprietario?.nome || '', 50, 12, fontBold);
  drawText(fatura.proprietario?.apartamento || '', 0, 12, fontBold, colorBlack, 'right');
  moveDown(30);

  // == COMPOSIÇÃO ==
  drawText('Composição da Fatura', 50, 11, fontBold);
  moveDown(15);

  if (detalhes?.itens && Array.isArray(detalhes.itens)) {
    detalhes.itens.forEach((item: any) => {
      drawText(item.descricao, 50, 10, fontRegular);
      drawText(formatCurrency(item.valor), 0, 10, fontRegular, colorBlack, 'right');
      moveDown(12);
      page.drawLine({ start: { x: 50, y: currentY }, end: { x: width - 50, y: currentY }, thickness: 0.5, color: colorLightGray });
      moveDown(10);
    });
  }

  moveDown(5);
  drawText('Total a Pagar', 50, 11, fontBold);
  drawText(formatCurrency(fatura.valor_total), 0, 11, fontBold, colorBlack, 'right');
  moveDown(30);

  // == OBSERVAÇÃO ==
  if (detalhes?.observacaoGeral) {
    const obsLines = splitTextToLines(detalhes.observacaoGeral, fontRegular, 10, width - 120);
    
    page.drawRectangle({
      x: 50, y: currentY - (obsLines.length * 12) - 20, 
      width: width - 100, height: (obsLines.length * 12) + 25,
      color: colorOrangeBg, borderColor: colorOrange, borderWidth: 1
    });
    
    moveDown(5);
    drawText('OBSERVAÇÃO', 60, 10, fontBold, colorOrange);
    moveDown(15);
    
    obsLines.forEach((l: string) => {
      drawText(l, 60, 10, fontRegular, colorOrange);
      moveDown(12);
    });
    moveDown(20);
  }

  // == DESPESAS DO MÊS ANTERIOR ==
  if (detalhes?.despesasAnteriores && detalhes.despesasAnteriores.itens?.length > 0) {
    drawText(`Despesas do Mês Anterior (${detalhes.despesasAnteriores.mes_ano})`, 50, 10, fontBold, colorBlack, 'center');
    moveDown(15);

    detalhes.despesasAnteriores.itens.forEach((d: any) => {
      const dtStr = d.data_pagamento ? `[${formatDate(d.data_pagamento)}] ` : '';
      const lineTxt = `${dtStr}${d.descricao}`;
      const truncTxt = lineTxt.length > 70 ? lineTxt.substring(0, 68) + '...' : lineTxt;
      
      drawText(truncTxt, 50, 9, fontRegular, colorBlack);
      drawText(formatCurrency(d.valor), 0, 9, fontRegular, colorBlack, 'right');
      moveDown(12);
    });

    moveDown(5);
    page.drawLine({ start: { x: 50, y: currentY }, end: { x: width - 50, y: currentY }, thickness: 0.5, color: colorLightGray });
    moveDown(12);
    drawText('Total de Despesas', 50, 10, fontBold);
    drawText(formatCurrency(detalhes.despesasAnteriores.total), 0, 10, fontBold, colorBlack, 'right');
    moveDown(30);
  }

  // == COMPROVANTE ==
  moveDown(10);
  const dashWidth = 5;
  for(let x = 50; x < width - 50; x += dashWidth * 2) {
      page.drawLine({ start: { x, y: currentY }, end: { x: x + dashWidth, y: currentY }, thickness: 1, color: colorLightGray });
  }
  moveDown(20);

  drawText('Comprovante Destacável', 50, 9, fontItalic, colorGray, 'center');
  moveDown(20);

  const boxY = currentY - 110;
  page.drawRectangle({ x: 50, y: boxY, width: width - 100, height: 120, borderColor: colorBlack, borderWidth: 1 });
  
  currentY -= 15;
  drawText(fatura.condominio?.nome?.toUpperCase() || '', 60, 10, fontBold);
  drawText('COMPROVANTE DE PAGAMENTO', 0, 10, fontRegular, colorBlack, 'right');
  page.drawText('COMPROVANTE DE PAGAMENTO', { x: width - 60 - fontRegular.widthOfTextAtSize('COMPROVANTE DE PAGAMENTO', 10), y: currentY - 10, size: 10, font: fontRegular });
  moveDown(25);

  drawText(`Apto: ${fatura.proprietario?.apartamento || ''}`, 60, 9, fontRegular);
  page.drawText(`Vencimento: ${formatDate(fatura.data_vencimento)}`, { x: width - 60 - fontRegular.widthOfTextAtSize(`Vencimento: ${formatDate(fatura.data_vencimento)}`, 9), y: currentY - 9, size: 9, font: fontRegular });
  moveDown(15);

  drawText(`Proprietário: ${fatura.proprietario?.nome || ''}`, 60, 9, fontRegular);
  page.drawText(`Valor: ${formatCurrency(fatura.valor_total)}`, { x: width - 60 - fontBold.widthOfTextAtSize(`Valor: ${formatCurrency(fatura.valor_total)}`, 10), y: currentY - 10, size: 10, font: fontBold });
  moveDown(15);

  drawText(`Referência: ${fatura.mes_ano}`, 60, 9, fontRegular);
  moveDown(30);

  page.drawLine({ start: { x: 60, y: currentY }, end: { x: 200, y: currentY }, thickness: 1, color: colorBlack });
  moveDown(15);
  drawText('Data de Pagamento: ___/___/_____', 60, 9, fontRegular);

  page.drawRectangle({ x: width - 250, y: currentY - 5, width: 190, height: 35, borderColor: colorBlack, borderWidth: 1 });
  page.drawText('Autenticação Mecânica', {
      x: width - 250 + (190 - fontRegular.widthOfTextAtSize('Autenticação Mecânica', 9))/2,
      y: currentY + 10,
      size: 9, font: fontRegular, color: colorGray
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
