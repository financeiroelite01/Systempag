'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const saved = localStorage.getItem('sp-theme') as 'light' | 'dark' | null;
    const initial = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(initial);
    setTheme(initial);
  }, []);

  function applyTheme(t: 'light' | 'dark') {
    const root = document.documentElement;
    if (t === 'dark') {
      root.style.setProperty('--sp-bg', '#111827');
      root.style.setProperty('--sp-bg2', '#1f2937');
      root.style.setProperty('--sp-card', '#1f2937');
      root.style.setProperty('--sp-text', '#f3f4f6');
      root.style.setProperty('--sp-text2', '#9ca3af');
      root.style.setProperty('--sp-border', '#374151');
      root.style.setProperty('--sp-primary', '#3b82f6');
      root.style.setProperty('--sp-primary-dark', '#1d4ed8');
    } else {
      root.style.setProperty('--sp-bg', '#f8fafc');
      root.style.setProperty('--sp-bg2', '#ffffff');
      root.style.setProperty('--sp-card', '#ffffff');
      root.style.setProperty('--sp-text', '#1e293b');
      root.style.setProperty('--sp-text2', '#64748b');
      root.style.setProperty('--sp-border', '#e2e8f0');
      root.style.setProperty('--sp-primary', '#0066cc');
      root.style.setProperty('--sp-primary-dark', '#003d7a');
    }
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('sp-theme', next);
    applyTheme(next);
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--sp-bg)',
      color: 'var(--sp-text)',
      transition: 'background-color 0.3s, color 0.3s'
    }}>
      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        borderBottom: '1px solid var(--sp-border)',
        backgroundColor: 'var(--sp-card)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 1.5rem',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 32, height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, var(--sp-primary), var(--sp-primary-dark))',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>SP</span>
            </div>
            <span style={{ fontWeight: 600, fontSize: 18, color: 'var(--sp-text)' }}>Systempag</span>
          </div>

          {/* Nav */}
          <nav style={{ display: 'flex', gap: '2rem' }}>
            {[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Relatórios', href: '#' },
              { label: 'Configurações', href: '#' }
            ].map(link => (
              <a key={link.label} href={link.href} style={{
                fontSize: 14, fontWeight: 500,
                color: 'var(--sp-text2)',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--sp-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--sp-text2)')}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Ações */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Toggle tema */}
            <button
              onClick={toggleTheme}
              title={theme === 'light' ? 'Tema escuro' : 'Tema claro'}
              style={{
                width: 36, height: 36,
                borderRadius: 8,
                border: '1px solid var(--sp-border)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--sp-text)',
                transition: 'background 0.2s'
              }}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {/* Divisor */}
            <div style={{ width: 1, height: 24, backgroundColor: 'var(--sp-border)' }} />

            {/* Avatar + Sair */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--sp-primary), var(--sp-primary-dark))',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ color: 'white', fontWeight: 600, fontSize: 12 }}>U</span>
              </div>
              <a href="/login" style={{
                fontSize: 14, fontWeight: 500,
                color: 'var(--sp-text2)',
                textDecoration: 'none'
              }}>Sair</a>
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
