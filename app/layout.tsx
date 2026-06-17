'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import './globals.css';

export const metadata = {
  title: 'Systempag - Gestão de Pagamentos',
  description: 'Plataforma profissional de gestão de pagamentos e comprovantes'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Detecta preferência do sistema ao carregar
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const initialTheme = saved || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  const applyTheme = (t: 'light' | 'dark') => {
    document.documentElement.setAttribute('data-theme', t);
  };

  if (!mounted) return null;

  return (
    <html lang="pt-BR" data-theme={theme} suppressHydrationWarning>
      <body className="bg-background text-foreground transition-colors duration-300">
        <ThemeProvider theme={theme} toggleTheme={toggleTheme}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

function ThemeProvider({ theme, toggleTheme, children }: { theme: string; toggleTheme: () => void; children: ReactNode }) {
  return (
    <div className="theme-context" data-theme={theme}>
      {/* Header Global */}
      <header className="sticky top-0 z-50 border-b border-border bg-card backdrop-blur-sm">
        <div className="flex h-16 items-center justify-between px-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-dark">
              <span className="text-sm font-bold text-white">SP</span>
            </div>
            <span className="text-lg font-semibold text-foreground">Systempag</span>
          </div>

          {/* Nav Center */}
          <nav className="hidden md:flex gap-8">
            <a href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Dashboard
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Relatórios
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Configurações
            </a>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-background transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.536l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zm5.657-9.193a1 1 0 00-1.414 0l-.707.707A1 1 0 005.05 6.464l.707-.707a1 1 0 001.414-1.414l-.707-.707zM5 8a1 1 0 100-2H4a1 1 0 100 2h1z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {/* User Menu */}
            <div className="flex items-center gap-3 pl-4 border-l border-border">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary-dark" />
              <button className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-screen bg-background">
        {children}
      </main>
    </div>
  );
}
