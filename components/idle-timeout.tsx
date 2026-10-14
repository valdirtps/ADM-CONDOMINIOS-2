'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function IdleTimeout() {
  const router = useRouter();
  const pathname = usePathname();
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Não aplicar timeout se não estiver em rotas autenticadas
    if (pathname === '/login' || pathname === '/') return;

    const handleLogout = async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
      } catch (error) {
        console.error('Logout failed', error);
      }
    };

    const resetTimer = () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
      // 1 minuto = 1 * 60 * 1000 ms = 60000 ms
      timeoutId.current = setTimeout(handleLogout, 60000);
    };

    const events = ['mousemove', 'keydown', 'wheel', 'mousedown', 'touchstart', 'touchmove'];

    const handleEvent = () => {
      resetTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleEvent);
    });

    // Iniciar timer na primeira renderização
    resetTimer();

    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleEvent);
      });
    };
  }, [pathname, router]);

  return null;
}
