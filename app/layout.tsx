import type { Metadata } from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Remix ADM CONDOMINIOS',
  description: 'SISTEMA WEB DE GESTÃO DE CONDOMÍNIOS (COMPLETO)',
  openGraph: {
    title: 'Remix ADM CONDOMINIOS',
    description: 'SISTEMA WEB DE GESTÃO DE CONDOMÍNIOS (COMPLETO)',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={cn("font-sans", geist.variable)}>
      <body suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
