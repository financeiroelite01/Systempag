// Server Component — sem 'use client' aqui
import type { ReactNode } from 'react';
import './globals.css';
import { AppShell } from '@/components/app-shell';

export const metadata = {
  title: 'Systempag - Gestão de Pagamentos',
  description: 'Plataforma profissional de gestão de pagamentos e comprovantes'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
