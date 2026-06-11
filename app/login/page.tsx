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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12">
      <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-white p-8 shadow-soft">
        <span className="badge">Acesso ao SaaS</span>
        <h1 className="mt-5 text-3xl font-semibold text-slate-900">{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
        <p className="mt-2 text-sm text-slate-500">Use email e senha para acessar o painel financeiro.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <input type="email" placeholder="Seu email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full" />
          <input type="password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full" />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-500 disabled:opacity-70"
          >
            {loading ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}

        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          className="mt-6 text-sm font-medium text-brand-700"
        >
          {mode === 'login' ? 'Ainda não tem conta? Criar agora' : 'Já tem conta? Fazer login'}
        </button>
      </div>
    </main>
  );
}
