'use client';
import { Button } from '@/components/ui/button';
import { Printer, FileDown, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface BalancetePrintButtonProps {
  sindico?: any;
  mesAno: string;
  condominioNome: string;
  condominioId: string;
}

export function BalancetePrintButton({ sindico, mesAno, condominioNome, condominioId }: BalancetePrintButtonProps) {
  const handleGeneratePDF = async () => {
    const element = document.querySelector('.printable-area');
    if (!element) {
      toast.error('Área de impressão não encontrada');
      return;
    }

    try {
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');
      
      const [year, month] = mesAno.split('-');
      const filename = `Balancete_${condominioNome.replace(/\s+/g, '_')}_${month}_${year}.pdf`;

      toast.info('Gerando PDF...');

      // Captura a imagem do elemento usando html-to-image que suporta oklch via foreignObject
      const dataUrl = await toPng(element as HTMLElement, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        width: element.scrollWidth,
        height: element.scrollHeight,
        style: {
          margin: '0',
          padding: '20px', // Garante um respiro interno na imagem capturada
        }
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const margin = 10; // 10mm de margem em todos os lados
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Largura e altura úteis da página (subtraindo as margens)
      const usableWidth = pdfWidth - (margin * 2);
      const usableHeight = pageHeight - (margin * 2);
      
      // Calcula a altura do conteúdo proporcional à largura útil
      const contentHeight = (imgProps.height * usableWidth) / imgProps.width;

      let heightLeft = contentHeight;
      let position = margin; // Inicia na margem superior

      // Adiciona a primeira página
      pdf.addImage(dataUrl, 'PNG', margin, position, usableWidth, contentHeight);
      heightLeft -= usableHeight;

      // Adiciona páginas extras se necessário
      while (heightLeft > 0) {
        pdf.addPage();
        // A posição negativa simula o "scroll" do conteúdo para a próxima página
        position = margin - (contentHeight - heightLeft);
        pdf.addImage(dataUrl, 'PNG', margin, position, usableWidth, contentHeight);
        heightLeft -= usableHeight;
      }

      pdf.save(filename);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  };

  const handleWhatsAppShare = () => {
    if (!sindico || (!sindico.proprietario?.telefone && !sindico.telefone)) {
      toast.error('Telefone do síndico não encontrado');
      return;
    }

    const telefone = sindico.proprietario?.telefone || sindico.telefone;
    let cleanPhone = telefone.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }
    const [year, month] = mesAno.split('-');
    
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pdfUrl = `${origin}/api/balancete-pdf/${condominioId}/${mesAno}`;
    
    const message = `Olá, segue o Balancete do Condomínio ${condominioNome} referente ao mês ${month}/${year} (acesse o PDF diretamente neste link): ${pdfUrl}`;
    const url = `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex gap-2">
      <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2">
        <Printer size={16} /> Imprimir
      </Button>
      
      <Button onClick={handleGeneratePDF} variant="outline" size="sm" className="gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700">
        <FileDown size={16} /> Gerar PDF
      </Button>

      <Button onClick={handleWhatsAppShare} variant="outline" size="sm" className="gap-2 bg-green-50 hover:bg-green-100 border-green-200 text-green-700">
        <MessageCircle size={16} /> WhatsApp Síndico
      </Button>
    </div>
  );
}
