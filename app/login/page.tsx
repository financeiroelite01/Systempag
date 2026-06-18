'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const action = mode === 'login'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });

    const { error } = await action;

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (mode === 'signup') {
      setMessage('Conta criada. Se a confirmação por email estiver ativa, confirme antes de entrar.');
    } else {
      router.push('/dashboard');
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen">

      {/* ── Lado esquerdo: gradiente + ilustração ── */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 px-12 text-white">

        {/* Círculos decorativos de fundo */}
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 -right-20 h-[500px] w-[500px] rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/4 h-48 w-48 rounded-full bg-white/5" />

        {/* Logo */}
        <div className="relative z-10 mb-12 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <span className="text-lg font-bold">SP</span>
          </div>
          <span className="text-xl font-semibold tracking-tight">Systempag</span>
        </div>

        {/* Ilustração SVG — dashboard financeiro */}
        <div className="relative z-10 w-full max-w-sm">
          <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full drop-shadow-2xl">
            {/* Card principal */}
            <rect x="20" y="20" width="360" height="260" rx="16" fill="white" fillOpacity="0.12"/>
            <rect x="20" y="20" width="360" height="260" rx="16" stroke="white" strokeOpacity="0.2" strokeWidth="1"/>

            {/* Header do card */}
            <rect x="20" y="20" width="360" height="52" rx="16" fill="white" fillOpacity="0.08"/>
            <circle cx="52" cy="46" r="12" fill="white" fillOpacity="0.3"/>
            <rect x="72" y="38" width="80" height="8" rx="4" fill="white" fillOpacity="0.5"/>
            <rect x="72" y="50" width="50" height="6" rx="3" fill="white" fillOpacity="0.3"/>

            {/* Cards de métricas */}
            <rect x="36" y="88" width="100" height="60" rx="10" fill="white" fillOpacity="0.12"/>
            <rect x="36" y="96" width="50" height="6" rx="3" fill="white" fillOpacity="0.4"/>
            <rect x="36" y="108" width="70" height="12" rx="4" fill="white" fillOpacity="0.7"/>
            <rect x="36" y="126" width="40" height="5" rx="2" fill="#6ee7b7" fillOpacity="0.8"/>

            <rect x="150" y="88" width="100" height="60" rx="10" fill="white" fillOpacity="0.12"/>
            <rect x="150" y="96" width="50" height="6" rx="3" fill="white" fillOpacity="0.4"/>
            <rect x="150" y="108" width="70" height="12" rx="4" fill="white" fillOpacity="0.7"/>
            <rect x="150" y="126" width="40" height="5" rx="2" fill="#6ee7b7" fillOpacity="0.8"/>

            <rect x="264" y="88" width="100" height="60" rx="10" fill="white" fillOpacity="0.12"/>
            <rect x="264" y="96" width="50" height="6" rx="3" fill="white" fillOpacity="0.4"/>
            <rect x="264" y="108" width="70" height="12" rx="4" fill="white" fillOpacity="0.7"/>
            <rect x="264" y="126" width="40" height="5" rx="2" fill="#fcd34d" fillOpacity="0.8"/>

            {/* Gráfico de barras */}
            <rect x="36" y="165" width="14" height="60" rx="4" fill="white" fillOpacity="0.2"/>
            <rect x="58" y="185" width="14" height="40" rx="4" fill="white" fillOpacity="0.2"/>
            <rect x="80" y="155" width="14" height="70" rx="4" fill="white" fillOpacity="0.6"/>
            <rect x="102" y="175" width="14" height="50" rx="4" fill="white" fillOpacity="0.2"/>
            <rect x="124" y="160" width="14" height="65" rx="4" fill="white" fillOpacity="0.4"/>
            <rect x="146" y="170" width="14" height="55" rx="4" fill="white" fillOpacity="0.2"/>

            {/* Lista de itens */}
            <rect x="190" y="165" width="180" height="10" rx="3" fill="white" fillOpacity="0.3"/>
            <rect x="190" y="183" width="140" height="10" rx="3" fill="white" fillOpacity="0.2"/>
            <rect x="190" y="201" width="160" height="10" rx="3" fill="white" fillOpacity="0.25"/>
            <rect x="190" y="219" width="120" height="10" rx="3" fill="white" fillOpacity="0.15"/>

            {/* Checkmarks */}
            <circle cx="178" cy="170" r="6" fill="#6ee7b7" fillOpacity="0.7"/>
            <circle cx="178" cy="188" r="6" fill="#6ee7b7" fillOpacity="0.7"/>
            <circle cx="178" cy="206" r="6" fill="#fcd34d" fillOpacity="0.7"/>
            <circle cx="178" cy="224" r="6" fill="#6ee7b7" fillOpacity="0.7"/>
          </svg>
        </div>

        {/* Textos */}
        <div className="relative z-10 mt-10 text-center">
          <h2 className="text-2xl font-bold leading-snug">
            Gestão financeira<br/>inteligente
          </h2>
          <p className="mt-3 text-sm text-white/70 leading-relaxed max-w-xs">
            Controle pagamentos, concilie extratos e exporte relatórios com leitura automática de comprovantes PDF.
          </p>
        </div>

        {/* Indicadores */}
        <div className="relative z-10 mt-8 flex gap-6 text-center">
          {[
            { value: '+1.240', label: 'Pagamentos' },
            { value: '99%', label: 'Precisão' },
            { value: '3 seg', label: 'Por PDF' },
          ].map(stat => (
            <div key={stat.label}>
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-xs text-white/60">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Lado direito: formulário ── */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-slate-950 px-8 py-12">

        {/* Logo mobile */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600">
            <span className="text-sm font-bold text-white">SP</span>
          </div>
          <span className="text-lg font-semibold text-white">Systempag</span>
        </div>

        <div className="w-full max-w-sm">
          {/* Título */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">
              {mode === 'login' ? 'Bem-vindo' : 'Criar conta'}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {mode === 'login'
                ? 'Entre com suas credenciais para acessar o painel.'
                : 'Preencha os dados para criar sua conta.'}
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                E-mail
              </label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Senha
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all"
              />
            </div>

            {/* Mensagem de erro/sucesso */}
            {message && (
              <div className={`rounded-xl px-4 py-3 text-sm ${
                message.toLowerCase().includes('criada') || message.toLowerCase().includes('confirme')
                  ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800'
                  : 'bg-red-900/40 text-red-400 border border-red-800'
              }`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-900/40 hover:bg-brand-500 active:scale-95 disabled:opacity-60 transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Processando...
                </span>
              ) : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          {/* Alternância login/signup */}
          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}
              className="font-medium text-brand-400 hover:text-brand-300 transition-colors"
            >
              {mode === 'login' ? 'Criar agora' : 'Fazer login'}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
