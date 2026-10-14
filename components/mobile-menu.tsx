'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Home, Users, Settings, FileText, DollarSign, UserCheck, Calendar, Flame } from 'lucide-react';

interface MobileMenuProps {
  user: {
    nome: string;
    role: string;
  };
  condominioNome: string;
}

export function MobileMenu({ user, condominioNome }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  const menuItems = [
    {
      href: "/dashboard",
      label: "Fluxo de Caixa",
      icon: Home,
      show: true,
    },
    {
      href: "/dashboard/condominios",
      label: "Condomínios",
      icon: Users,
      show: user.role === 'ADMIN_SISTEMA',
    },
    {
      href: "/dashboard/proprietarios",
      label: "Proprietários",
      icon: Users,
      show: user.role !== 'USUARIO' && user.role !== 'ADMIN_SISTEMA',
    },
    {
      href: "/dashboard/sindico",
      label: "Síndico",
      icon: UserCheck,
      show: user.role !== 'USUARIO' && user.role !== 'ADMIN_SISTEMA',
    },
    {
      href: "/dashboard/lancamentos",
      label: "Lançamentos",
      icon: DollarSign,
      show: user.role !== 'USUARIO' && user.role !== 'ADMIN_SISTEMA',
    },
    {
      href: "/dashboard/faturas",
      label: "Faturas",
      icon: FileText,
      show: user.role !== 'USUARIO' && user.role !== 'ADMIN_SISTEMA',
    },
    {
      href: "/dashboard/agendas",
      label: "Agenda de Serviços",
      icon: Calendar,
      show: user.role !== 'USUARIO' && user.role !== 'ADMIN_SISTEMA',
    },
    {
      href: "/dashboard/configuracoes",
      label: "Configurações",
      icon: Settings,
      show: user.role !== 'USUARIO' && user.role !== 'ADMIN_SISTEMA',
    },
    {
      href: "/dashboard/migracao",
      label: "Migração Firebase",
      icon: Flame,
      show: user.role !== 'USUARIO',
    },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none md:hidden cursor-pointer"
        aria-label="Toggle menu"
      >
        <Menu size={24} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black z-40 md:hidden"
            />

            {/* Sidebar content drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 text-slate-50 z-50 p-6 flex flex-col md:hidden box-border"
            >
              <div className="flex justify-between items-center pb-6 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white">Gestão Condomínio</h2>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{user.nome}</p>
                  {condominioNome && (
                    <p className="text-sm text-red-500 font-bold mt-1 line-clamp-1">{condominioNome}</p>
                  )}
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 py-6 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                  if (!item.show) return null;
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleLinkClick}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors font-medium ${
                        isActive
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={async () => {
                    try {
                      await fetch('/api/auth/logout', { method: 'POST' });
                      sessionStorage.clear();
                      localStorage.clear();
                      document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
                      window.location.replace('/login');
                    } catch {
                      window.location.replace('/login');
                    }
                  }}
                  className="flex items-center gap-3 w-full p-3 rounded-lg text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors font-medium cursor-pointer"
                >
                  <X size={20} />
                  <span>Sair do Sistema</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
