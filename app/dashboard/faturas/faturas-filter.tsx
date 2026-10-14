'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function FaturasFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [date, setDate] = useState(searchParams.get('vencimento') || '');

  const handleFilter = (val: string) => {
    setDate(val);
    const params = new URLSearchParams(searchParams);
    if (val) {
      params.set('vencimento', val);
    } else {
      params.delete('vencimento');
    }
    router.push(`/dashboard/faturas?${params.toString()}`);
  };

  const clearFilter = () => {
    setDate('');
    router.push('/dashboard/faturas');
  };

  return (
    <div className="flex items-end gap-4 bg-muted/50 p-4 rounded-lg border">
      <div className="grid gap-1.5">
        <Label htmlFor="vencimento">Filtrar por Vencimento</Label>
        <div className="flex gap-2">
          <Input
            id="vencimento"
            type="date"
            value={date}
            onChange={(e) => handleFilter(e.target.value)}
            className="w-[200px]"
          />
          {date && (
            <Button variant="ghost" size="icon" onClick={clearFilter} title="Limpar filtro">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
