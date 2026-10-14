'use client';

import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

export function SendWhatsappButton({ 
  faturaId, 
  telefone,
  mesAno,
  apartamento
}: { 
  faturaId: string; 
  telefone: string | null;
  mesAno: string;
  apartamento: string;
}) {
  const handleSend = () => {
    if (!telefone) return;
    
    // Clean phone number
    let cleanPhone = telefone.replace(/\D/g, '');
    
    // Auto-add Brazil country code if it seems like a local DDD + number (10 or 11 digits)
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    // Prepare direct link for the PDF
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pdfUrl = `${origin}/api/faturas-pdf/${faturaId}`;
    
    const text = `Olá! Segue a fatura do apartamento ${apartamento} referente a ${mesAno} (acesse o PDF diretamente neste link): ${pdfUrl}`;
    
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  if (!telefone) {
    return (
      <Button variant="ghost" size="sm" title="Proprietário sem WhatsApp cadastrado" disabled>
        <MessageCircle className="h-4 w-4 text-gray-300" />
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSend} title={`Enviar WhatsApp para: ${telefone}`}>
      <MessageCircle className="h-4 w-4 text-green-600" />
    </Button>
  );
}
