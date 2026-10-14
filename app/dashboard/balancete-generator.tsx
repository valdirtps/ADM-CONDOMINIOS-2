'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function BalanceteGenerator() {
  const [mesAno, setMesAno] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <input
        type="month"
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        value={mesAno}
        onChange={(e) => setMesAno(e.target.value)}
      />
      <Button 
        variant="outline" 
        onClick={() => {
          if (mesAno) {
            router.push(`/dashboard/balancete?mes_ano=${mesAno}`);
          }
        }}
      >
        <FileText className="h-4 w-4 mr-2" />
        Gerar Balancete
      </Button>
    </div>
  );
}
