import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gestão Empresas SaaS',
  description: 'Plataforma para gestão de pagamentos com leitura de PDF, dashboard e exportação em Excel.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
