import Link from 'next/link';
import { ArrowRight, Building2, FileSpreadsheet, FileText, ShieldCheck } from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Leitura inteligente de PDF',
    description: 'Upload de comprovantes e extração automática de banco, valor, data, referência e NF.'
  },
  {
    icon: Building2,
    title: 'Gestão por empresa',
    description: 'Cadastre empresas, vincule pagamentos e mantenha a operação organizada em um único painel.'
  },
  {
    icon: FileSpreadsheet,
    title: 'Relatórios em Excel',
    description: 'Exporte por empresa com layout pronto para prestação de contas, auditoria e conferência financeira.'
  },
  {
    icon: ShieldCheck,
    title: 'Base segura com Supabase',
    description: 'Autenticação, banco de dados e storage integrados para um MVP pronto para evoluir.'
  }
];

export default function HomePage() {
  return (
    <main className="overflow-hidden bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-16 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="badge border-brand-500/20 bg-brand-500/10 text-brand-200">MVP pronto para monetizar</span>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
              Controle financeiro de múltiplas empresas com leitura automática de comprovantes em PDF.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-300">
              Um SaaS pensado para administradores financeiros: upload de comprovantes, extração de dados, dashboard por empresa,
              exportação em Excel e estrutura pronta para deploy em Vercel com Supabase.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl bg-brand-500 px-6 py-4 font-semibold text-white hover:bg-brand-400"
              >
                Entrar no sistema <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <a
                href="#funcionalidades"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-6 py-4 font-semibold text-white/90 hover:bg-white/5"
              >
                Ver funcionalidades
              </a>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="rounded-[28px] bg-white p-6 text-slate-900 shadow-soft">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-100 p-5">
                  <p className="text-sm text-slate-500">Pagamentos processados</p>
                  <p className="mt-2 text-3xl font-semibold">+1.240</p>
                  <p className="mt-2 text-sm text-emerald-600">Extração assistida e revisão manual</p>
                </div>
                <div className="rounded-2xl bg-brand-50 p-5">
                  <p className="text-sm text-brand-700">Relatórios exportados</p>
                  <p className="mt-2 text-3xl font-semibold text-brand-900">Excel por empresa</p>
                  <p className="mt-2 text-sm text-brand-700">Formato pronto para conferência</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">Fluxo resumido</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">MVP funcional</span>
                </div>
                <ol className="mt-4 space-y-3 text-sm text-slate-600">
                  <li>1. Cadastro de empresa</li>
                  <li>2. Upload do PDF e leitura automática</li>
                  <li>3. Vinculação do pagamento à empresa</li>
                  <li>4. Dashboard e exportação em Excel</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="funcionalidades" className="mx-auto max-w-7xl px-6 pb-24 lg:px-10">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {features.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="inline-flex rounded-2xl bg-brand-500/20 p-3 text-brand-200">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-xl font-semibold">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
