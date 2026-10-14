'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Printer } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState } from 'react';
import { toast } from 'sonner';

export function FaturaView({ fatura }: { fatura: any }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const detalhes = JSON.parse(fatura.detalhes);
  const sindico = fatura.condominio.sindicos[0];
  const nomeSindico = sindico?.proprietario ? `Apto ${sindico.proprietario.apartamento} - ${sindico.proprietario.nome}` : sindico?.empresa_nome || 'Não definido';

  const handlePrintPDF = async () => {
    setIsGenerating(true);
    try {
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');
      
      const element = document.getElementById('fatura-print');
      if (!element) throw new Error('Element not found');
      
      // Get image from DOM via SVG foreignObject (supports modern CSS like oklch natively)
      const dataUrl = await toPng(element, { 
        quality: 1, 
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
      });
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10; // Margem de 10mm
      const usableWidth = pdfWidth - (margin * 2);
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const imgHeight = (imgProps.height * usableWidth) / imgProps.width;
      
      // Se a altura for maior que a página, escala para caber (faturas geralmente cabem em uma A4)
      const finalHeight = imgHeight > (pdfHeight - margin * 2) ? (pdfHeight - margin * 2) : imgHeight;
      const finalWidth = imgHeight > (pdfHeight - margin * 2) ? (usableWidth * (pdfHeight - margin * 2) / imgHeight) : usableWidth;
      
      // Centraliza horizontalmente
      const xOffset = (pdfWidth - finalWidth) / 2;
      
      pdf.addImage(dataUrl, 'PNG', xOffset, margin, finalWidth, finalHeight);
      pdf.save(`fatura-${fatura.mes_ano}-apto-${fatura.proprietario.apartamento}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-3xl font-bold tracking-tight">Fatura - {fatura.mes_ano}</h1>
        <Button onClick={handlePrintPDF} disabled={isGenerating}>
          <Printer className="mr-2 h-4 w-4" /> {isGenerating ? 'Gerando...' : 'Baixar PDF'}
        </Button>
      </div>

      <div className="print:block" id="fatura-print">
        <Card className="rounded-none border-2 border-black print:shadow-none">
          <CardHeader className="border-b-2 border-black pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl uppercase">{fatura.condominio.nome}</CardTitle>
                <p className="text-sm">{fatura.condominio.endereco}, {fatura.condominio.numero || 'S/N'}, {fatura.condominio.cidade} - {fatura.condominio.uf}</p>
                <p className="text-sm">CNPJ: {fatura.condominio.cnpj}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">RECIBO DE CONDOMÍNIO</p>
                <p className="text-sm">Vencimento: {format(new Date(new Date(fatura.data_vencimento).getTime() + new Date().getTimezoneOffset() * 60000), 'dd/MM/yyyy')}</p>
                <p className="text-sm">Emissão: {format(new Date(fatura.createdAt), 'dd/MM/yyyy')}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-black">
              <p className="text-sm font-bold">Síndico: <span className="font-normal">{nomeSindico}</span></p>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex justify-between border-b border-gray-300 pb-4">
              <div>
                <p className="text-sm text-black font-medium">Proprietário</p>
                <p className="font-bold text-lg">{fatura.proprietario.nome}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-black font-medium">Apartamento</p>
                <p className="font-bold text-lg">{fatura.proprietario.apartamento}</p>
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-2">Composição da Fatura</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalhes.itens.map((item: any, i: number) => {
                    let desc = item.descricao;
                    if (desc.includes('Multa/Juros por Atraso') || desc.includes('Multa por Atraso')) {
                      desc = desc.replace('Valor Exclusivo: ', '');
                    } else if (desc.startsWith('Valor Exclusivo: ')) {
                      desc = desc.replace('Valor Exclusivo: ', 'Valor Exclusivo - ');
                    }
                    return (
                    <TableRow key={i}>
                      <TableCell>{desc}</TableCell>
                      <TableCell className="text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</TableCell>
                    </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell className="font-bold text-lg">Total Fatura</TableCell>
                    <TableCell className="text-right font-bold text-lg">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fatura.valor_total)}
                    </TableCell>
                  </TableRow>
                  {(fatura.status === 'PAGO' && (fatura.multa > 0 || fatura.juros > 0)) && (
                    <>
                      <TableRow>
                        <TableCell>Acréscimos (Multa/Juros) - Pgto em {fatura.data_pagamento ? format(new Date(new Date(fatura.data_pagamento).getTime() + new Date().getTimezoneOffset() * 60000), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell className="text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fatura.multa + fatura.juros)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold text-lg text-red-700">Total Pago</TableCell>
                        <TableCell className="text-right font-bold text-lg text-red-700">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fatura.valor_pago || (fatura.valor_total + fatura.multa + fatura.juros))}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                  {fatura.status === 'PAGO' && (fatura.multa === 0 && fatura.juros === 0) && (
                    <TableRow>
                        <TableCell className="font-bold text-green-700">Valor Pago (em {fatura.data_pagamento ? format(new Date(new Date(fatura.data_pagamento).getTime() + new Date().getTimezoneOffset() * 60000), 'dd/MM/yyyy') : '-'})</TableCell>
                        <TableCell className="text-right font-bold text-green-700">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fatura.valor_pago || fatura.valor_total)}
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {detalhes.observacaoGeral && (
              <div className="mt-8 border p-4 rounded-lg bg-orange-50 border-orange-200">
                <h3 className="font-bold text-sm text-orange-800 mb-2 uppercase tracking-wider flex items-center">
                  Observação
                </h3>
                <p className="text-sm text-orange-900 whitespace-pre-wrap">
                  {detalhes.observacaoGeral}
                </p>
              </div>
            )}

            {detalhes.despesasAnteriores && detalhes.despesasAnteriores.itens.length > 0 && (
              <div className="mt-8 border p-4 rounded-lg bg-gray-50/50">
                <h3 className="font-bold text-sm text-black mb-4 border-b pb-2 uppercase text-center tracking-wider">
                  Despesas do Mês Anterior ({detalhes.despesasAnteriores.mes_ano})
                </h3>
                <div className="space-y-2">
                  {detalhes.despesasAnteriores.itens.map((d: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-black font-medium">
                        {d.data_pagamento ? `[${format(new Date(new Date(d.data_pagamento).getTime() + new Date().getTimezoneOffset() * 60000), 'dd/MM/yyyy')}] ` : ''}
                        {d.descricao}
                      </span>
                      <span className="font-bold text-black">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.valor)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 flex justify-between border-t border-gray-200">
                  <span className="font-bold text-black text-sm">Total de Despesas</span>
                  <span className="font-bold text-black text-sm">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(detalhes.despesasAnteriores.total)}
                  </span>
                </div>
                <p className="text-xs text-black font-medium mt-4 text-center">
                  * Este quadro é apenas demonstrativo e não altera o valor da fatura atual.
                </p>
              </div>
            )}

            <div className="border-t-2 border-dashed border-gray-400 my-8"></div>

            <div className="text-center text-sm text-black font-medium mb-4">
              ✂️ Comprovante Destacável
            </div>

            <div className="border-2 border-black p-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold uppercase">{fatura.condominio.nome}</h4>
                <p className="font-bold">COMPROVANTE DE PAGAMENTO</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>Apto:</strong> {fatura.proprietario.apartamento}</p>
                  <p><strong>Proprietário:</strong> {fatura.proprietario.nome}</p>
                  <p><strong>Referência:</strong> {fatura.mes_ano}</p>
                </div>
                <div className="text-right">
                  <p><strong>Vencimento:</strong> {format(new Date(new Date(fatura.data_vencimento).getTime() + new Date().getTimezoneOffset() * 60000), 'dd/MM/yyyy')}</p>
                  <p><strong>Valor:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fatura.valor_total)}</p>
                </div>
              </div>
              <div className="mt-6 flex justify-between items-end">
                <div className="border-b border-black w-48 pb-1">
                  <span className="text-xs">Data de Pagamento: ___/___/_____</span>
                </div>
                <div className="border border-black p-4 w-64 h-16 flex items-center justify-center text-black font-medium text-xs">
                  Autenticação Mecânica
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
