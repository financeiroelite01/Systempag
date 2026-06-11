'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, FileDown, FilePlus2, LogOut, Upload } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

type Company = {
  id: string;
  legal_name: string;
  display_name: string | null;
};

type Payment = {
  id: string;
  company_id: string;
  company_name: string;
  payment_date: string | null;
  reference: string;
  amount: number | null;
  bank_name: string | null;
  invoice_number: string | null;
  extraction_status: 'pending' | 'processed' | 'review' | 'error';
};

export function DashboardShell({
  userEmail,
  companies,
  payments
}: {
  userEmail: string;
  companies: Company[];
  payments: Payment[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>('');

  const filteredPayments = useMemo(() => {
    if (selectedCompany === 'all') return payments;
    return payments.filter((payment) => payment.company_id === selectedCompany);
  }, [payments, selectedCompany]);

  const totalAmount = filteredPayments.reduce((acc, payment) => acc + Number(payment.amount || 0), 0);
  const processedCount = filteredPayments.filter((payment) => payment.extraction_status === 'processed').length;

  async function signOut() {
    setLoadingAction('logout');
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function handleCreateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAction('company');
    setFeedback('');
    const form = new FormData(event.currentTarget);

    const response = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legalName: form.get('legalName'),
        displayName: form.get('displayName'),
        taxId: form.get('taxId')
      })
    });

    const data = await response.json();
    setFeedback(data.message || (response.ok ? 'Empresa criada com sucesso.' : 'Erro ao criar empresa.'));
    setLoadingAction(null);

    if (response.ok) {
      event.currentTarget.reset();
      router.refresh();
    }
  }

  async function handleManualPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAction('manual-payment');
    setFeedback('');
    const form = new FormData(event.currentTarget);

    const response = await fetch('/api/payments/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: form.get('companyId'),
        reference: form.get('reference'),
        invoiceNumber: form.get('invoiceNumber'),
        bankName: form.get('bankName'),
        paymentDate: form.get('paymentDate'),
        amount: form.get('amount')
      })
    });

    const data = await response.json();
    setFeedback(data.message || (response.ok ? 'Pagamento cadastrado.' : 'Erro ao cadastrar pagamento.'));
    setLoadingAction(null);

    if (response.ok) {
      event.currentTarget.reset();
      router.refresh();
    }
  }

  async function handleUploadPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAction('upload');
    setFeedback('');
    const form = new FormData(event.currentTarget);

    const response = await fetch('/api/payments/upload', {
      method: 'POST',
      body: form
    });

    const data = await response.json();
    setFeedback(data.message || (response.ok ? 'PDF processado.' : 'Erro no upload do PDF.'));
    setLoadingAction(null);

    if (response.ok) {
      event.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <div>
            <span className="badge">Dashboard financeiro</span>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">Gestão de pagamentos por empresa</h1>
            <p className="mt-1 text-sm text-slate-500">Usuário logado: {userEmail}</p>
          </div>
          <button onClick={signOut} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <LogOut className="h-4 w-4" /> {loadingAction === 'logout' ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-8 px-6 py-8 lg:px-10">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card p-6">
            <p className="text-sm text-slate-500">Empresas cadastradas</p>
            <p className="mt-3 text-4xl font-semibold">{companies.length}</p>
          </div>
          <div className="card p-6">
            <p className="text-sm text-slate-500">Pagamentos no filtro</p>
            <p className="mt-3 text-4xl font-semibold">{filteredPayments.length}</p>
          </div>
          <div className="card p-6">
            <p className="text-sm text-slate-500">Valor total</p>
            <p className="mt-3 text-4xl font-semibold">{formatCurrency(totalAmount)}</p>
            <p className="mt-2 text-sm text-emerald-600">Processados automaticamente: {processedCount}</p>
          </div>
        </div>

        {feedback ? <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">{feedback}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-brand-50 p-3 text-brand-700"><Building2 className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-semibold">Cadastrar empresa</h2>
                <p className="text-sm text-slate-500">Cada pagamento ficará vinculado a uma empresa.</p>
              </div>
            </div>
            <form onSubmit={handleCreateCompany} className="mt-6 grid gap-4 md:grid-cols-2">
              <input name="legalName" placeholder="Razão social" required />
              <input name="displayName" placeholder="Nome de exibição" />
              <input name="taxId" placeholder="CNPJ" className="md:col-span-2" />
              <button disabled={loadingAction === 'company'} className="rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-800 md:col-span-2">
                {loadingAction === 'company' ? 'Salvando...' : 'Salvar empresa'}
              </button>
            </form>
          </section>

          <section className="card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-brand-50 p-3 text-brand-700"><Upload className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-semibold">Upload de comprovante PDF</h2>
                <p className="text-sm text-slate-500">O nome do arquivo alimenta referência e NF automaticamente quando possível.</p>
              </div>
            </div>
            <form onSubmit={handleUploadPayment} className="mt-6 grid gap-4">
              <select name="companyId" required defaultValue="">
                <option value="" disabled>Selecione a empresa</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.display_name || company.legal_name}</option>
                ))}
              </select>
              <input type="file" name="file" accept="application/pdf" required />
              <button disabled={loadingAction === 'upload'} className="rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-500">
                {loadingAction === 'upload' ? 'Processando PDF...' : 'Enviar PDF e extrair dados'}
              </button>
            </form>
          </section>
        </div>

        <section className="card p-6">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700"><FilePlus2 className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-lg font-semibold">Cadastro manual</h2>
                  <p className="text-sm text-slate-500">Útil para ajustes quando o PDF não trouxer todos os campos.</p>
                </div>
              </div>
              <form onSubmit={handleManualPayment} className="mt-6 grid gap-4 md:grid-cols-2">
                <select name="companyId" required defaultValue="" className="md:col-span-2">
                  <option value="" disabled>Selecione a empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.display_name || company.legal_name}</option>
                  ))}
                </select>
                <input name="reference" placeholder="Referência" required />
                <input name="invoiceNumber" placeholder="NF" />
                <input name="bankName" placeholder="Banco do pagamento" />
                <input name="paymentDate" type="date" required />
                <input name="amount" type="number" step="0.01" placeholder="Valor" required className="md:col-span-2" />
                <button disabled={loadingAction === 'manual-payment'} className="rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-800 md:col-span-2">
                  {loadingAction === 'manual-payment' ? 'Salvando...' : 'Cadastrar pagamento manual'}
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-semibold">Relatórios em Excel</h3>
              <p className="mt-2 text-sm text-slate-500">Baixe um arquivo por empresa com as colunas: Data do pagamento, Referência, Valor, Banco do pagamento e NF.</p>
              <div className="mt-5 space-y-3">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => window.open(`/api/reports/${company.id}`, '_blank')}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50"
                  >
                    <span>{company.display_name || company.legal_name}</span>
                    <FileDown className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Lista de pagamentos</h2>
              <p className="text-sm text-slate-500">Visualização estilo dashboard com filtro por empresa.</p>
            </div>
            <select value={selectedCompany} onChange={(event) => setSelectedCompany(event.target.value)} className="w-full md:w-72">
              <option value="all">Todas as empresas</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.display_name || company.legal_name}</option>
              ))}
            </select>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-3 font-medium">Empresa</th>
                  <th className="px-3 py-3 font-medium">Data do pagamento</th>
                  <th className="px-3 py-3 font-medium">Referência</th>
                  <th className="px-3 py-3 font-medium">Valor</th>
                  <th className="px-3 py-3 font-medium">Banco</th>
                  <th className="px-3 py-3 font-medium">NF</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length ? (
                  filteredPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-4">{payment.company_name}</td>
                      <td className="px-3 py-4">{formatDate(payment.payment_date)}</td>
                      <td className="px-3 py-4">{payment.reference}</td>
                      <td className="px-3 py-4">{formatCurrency(payment.amount)}</td>
                      <td className="px-3 py-4">{payment.bank_name || '—'}</td>
                      <td className="px-3 py-4">{payment.invoice_number || '—'}</td>
                      <td className="px-3 py-4">
                        <span className="rounded-full px-3 py-1 text-xs font-semibold capitalize bg-slate-100 text-slate-700">
                          {payment.extraction_status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={7}>
                      Nenhum pagamento encontrado para o filtro atual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
