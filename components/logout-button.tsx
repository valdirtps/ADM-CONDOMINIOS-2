'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await fetch('/api/auth/logout', { method: 'POST' });
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
        localStorage.clear();
        document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
        window.location.replace('/login');
      }
    } catch (error) {
      console.error('Logout failed', error);
      if (typeof window !== 'undefined') {
        window.location.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleLogout}
      variant="ghost"
      size="sm"
      disabled={loading}
      className="flex items-center gap-2 hover:bg-slate-800 hover:text-white text-slate-300 cursor-pointer"
    >
      <LogOut size={16} /> {loading ? 'Saindo...' : 'Sair'}
    </Button>
  );
}
