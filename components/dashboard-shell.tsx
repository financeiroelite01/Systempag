'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, FileDown, FilePlus2, LogOut, Pencil, Trash2, Upload, X } from 'lucide-react';
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

type EditingPayment = {
  id: string;
  reference: string;
  invoiceNumber: string;
  bankName: string;
  paymentDate: string;
  amount: string;
};

const STATUS_LABEL: Record<string, string> = {
  processed: 'Processado',
  pending: 'Pendente',
  review: 'Revisar',
  error: 'Erro'
};

const STATUS_CLASS: Record<string, string> = {
  processed: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-slate-100 text-slate-600',
  review: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700'
};

export function DashboardShell({
  userEmail,
  companies,
  payments: initialPayments
}: {
  userEmail: string;
  companies: Company[];
  payments: Payment[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Estado de edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<EditingPayment | null>(null);

  // Estado de confirmação de exclusão
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal de reupload após exclusão: guarda fileName e companyId do pagamento excluído
  const [reuploadModal, setReuploadModal] = useState<{ fileName: string; companyId: string; companyName: string } | null>(null);

  const filteredPayments = useMemo(() => {
    if (selectedCompany === 'all') return payments;
    return payments.filter((p) => p.company_id === selectedCompany);
  }, [payments, selectedCompany]);

  const totalAmount = filteredPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const processedCount = filteredPayments.filter((p) => p.extraction_status === 'processed').length;

  function showFeedback(message: string, type: 'success' | 'error' = 'success') {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 5000);
  }

  async function signOut() {
    setLoadingAction('logout');
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  // ─── Empresa ────────────────────────────────────────────────────────────────
  async function handleCreateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAction('company');
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
    showFeedback(data.message || (response.ok ? 'Empresa criada.' : 'Erro ao criar empresa.'), response.ok ? 'success' : 'error');
    setLoadingAction(null);

    if (response.ok) {
      (event.target as HTMLFormElement).reset();
      router.refresh();
    }
  }

  // ─── Pagamento manual ────────────────────────────────────────────────────────
  async function handleManualPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAction('manual-payment');
    const form = new FormData(event.currentTarget);

    const body = {
      companyId: form.get('companyId'),
      reference: form.get('reference'),
      invoiceNumber: form.get('invoiceNumber'),
      bankName: form.get('bankName'),
      paymentDate: form.get('paymentDate'),
      amount: form.get('amount')
    };

    const response = await fetch('/api/payments/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    showFeedback(data.message || (response.ok ? 'Pagamento cadastrado.' : 'Erro.'), response.ok ? 'success' : 'error');
    setLoadingAction(null);

    if (response.ok) {
      (event.target as HTMLFormElement).reset();
      // Atualização otimista: busca a lista atualizada sem recarregar a página
      await refreshPayments();
    }
  }

  // ─── Upload PDF ──────────────────────────────────────────────────────────────
  async function handleUploadPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAction('upload');
    const form = new FormData(event.currentTarget);

    const response = await fetch('/api/payments/upload', {
      method: 'POST',
      body: form
    });

    const data = await response.json();
    showFeedback(data.message || (response.ok ? 'PDF processado.' : 'Erro no upload.'), response.ok ? 'success' : 'error');
    setLoadingAction(null);

    if (response.ok) {
      (event.target as HTMLFormElement).reset();
      await refreshPayments();
    }
  }

  // ─── Atualização da lista sem recarregar a página ────────────────────────────
  async function refreshPayments() {
    const { data } = await supabase
      .from('vw_payment_dashboard')
      .select('id, company_id, company_name, payment_date, reference, amount, bank_name, invoice_number, extraction_status')
      .order('created_at', { ascending: false })
      .limit(200);

    if (data) setPayments(data);
  }

  // ─── Edição inline ───────────────────────────────────────────────────────────
  function startEditing(payment: Payment) {
    setEditingId(payment.id);
    setDeletingId(null);
    setEditingData({
      id: payment.id,
      reference: payment.reference ?? '',
      invoiceNumber: payment.invoice_number ?? '',
      bankName: payment.bank_name ?? '',
      paymentDate: payment.payment_date ?? '',
      amount: payment.amount !== null ? String(payment.amount) : ''
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingData(null);
  }

  async function saveEditing() {
    if (!editingData) return;
    setLoadingAction(`edit-${editingData.id}`);

    // Atualização otimista: aplica no estado local imediatamente
    setPayments((prev) =>
      prev.map((p) =>
        p.id === editingData.id
          ? {
              ...p,
              reference: editingData.reference,
              invoice_number: editingData.invoiceNumber || null,
              bank_name: editingData.bankName || null,
              payment_date: editingData.paymentDate || null,
              amount: editingData.amount !== '' ? Number(editingData.amount) : null
            }
          : p
      )
    );

    setEditingId(null);
    setEditingData(null);

    const response = await fetch(`/api/payments/${editingData.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingData)
    });

    const data = await response.json();

    if (!response.ok) {
      // Reverte se falhou
      await refreshPayments();
      showFeedback(data.message || 'Erro ao salvar.', 'error');
    } else {
      showFeedback('Pagamento atualizado.', 'success');
    }

    setLoadingAction(null);
  }

  // ─── Exclusão ────────────────────────────────────────────────────────────────
  function confirmDelete(id: string) {
    setDeletingId(id);
    setEditingId(null);
    setEditingData(null);
  }

  function cancelDelete() {
    setDeletingId(null);
  }

  async function deletePayment(id: string) {
    setLoadingAction(`delete-${id}`);

    // Guarda os dados do pagamento antes de remover (para o modal de reupload)
    const target = payments.find((p) => p.id === id);

    // Atualização otimista: remove do estado local imediatamente
    setPayments((prev) => prev.filter((p) => p.id !== id));
    setDeletingId(null);

    const response = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
    const data = await response.json();

    if (!response.ok) {
      // Reverte se falhou
      await refreshPayments();
      showFeedback(data.message || 'Erro ao excluir.', 'error');
    } else {
      // Abre modal perguntando se quer lançar novamente
      if (target) {
        const company = companies.find((c) => c.id === target.company_id);
        setReuploadModal({
          fileName: target.reference,
          companyId: target.company_id,
          companyName: company?.display_name || company?.legal_name || 'empresa'
        });
      }
    }

    setLoadingAction(null);
  }

  // ─── Reupload após exclusão ──────────────────────────────────────────────────
  async function handleReupload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAction('reupload');
    const form = new FormData(event.currentTarget);

    const response = await fetch('/api/payments/upload', {
      method: 'POST',
      body: form
    });

    const data = await response.json();
    showFeedback(data.message || (response.ok ? 'PDF enviado.' : 'Erro no upload.'), response.ok ? 'success' : 'error');
    setLoadingAction(null);
    setReuploadModal(null);

    if (response.ok) await refreshPayments();
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <div>
            <span className="badge">Dashboard financeiro</span>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">Gestão de pagamentos por empresa</h1>
            <p className="mt-1 text-sm text-slate-500">Usuário logado: {userEmail}</p>
          </div>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            {loadingAction === 'logout' ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-8 px-6 py-8 lg:px-10">
        {/* Cards de resumo */}
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

        {/* Feedback global */}
        {feedback && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
              feedback.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-brand-200 bg-brand-50 text-brand-900'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Formulários: empresa + upload */}
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Cadastrar empresa</h2>
                <p className="text-sm text-slate-500">Cada pagamento ficará vinculado a uma empresa.</p>
              </div>
            </div>
            <form onSubmit={handleCreateCompany} className="mt-6 grid gap-4 md:grid-cols-2">
              <input name="legalName" placeholder="Razão social" required />
              <input name="displayName" placeholder="Nome de exibição" />
              <input name="taxId" placeholder="CNPJ" className="md:col-span-2" />
              <button
                disabled={loadingAction === 'company'}
                className="rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-70 md:col-span-2"
              >
                {loadingAction === 'company' ? 'Salvando...' : 'Salvar empresa'}
              </button>
            </form>
          </section>

          <section className="card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Upload de comprovante PDF</h2>
                <p className="text-sm text-slate-500">
                  Arquivos duplicados são bloqueados automaticamente.
                </p>
              </div>
            </div>
            <form onSubmit={handleUploadPayment} className="mt-6 grid gap-4">
              <select name="companyId" required defaultValue="">
                <option value="" disabled>Selecione a empresa</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.display_name || c.legal_name}</option>
                ))}
              </select>
              <input type="file" name="file" accept="application/pdf" required />
              <button
                disabled={loadingAction === 'upload'}
                className="rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-500 disabled:opacity-70"
              >
                {loadingAction === 'upload' ? 'Processando PDF...' : 'Enviar PDF e extrair dados'}
              </button>
            </form>
          </section>
        </div>

        {/* Cadastro manual + relatórios */}
        <section className="card p-6">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                  <FilePlus2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Cadastro manual</h2>
                  <p className="text-sm text-slate-500">Útil para ajustes quando o PDF não trouxer todos os campos.</p>
                </div>
              </div>
              <form onSubmit={handleManualPayment} className="mt-6 grid gap-4 md:grid-cols-2">
                <select name="companyId" required defaultValue="" className="md:col-span-2">
                  <option value="" disabled>Selecione a empresa</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.display_name || c.legal_name}</option>
                  ))}
                </select>
                <input name="reference" placeholder="Referência" required />
                <input name="invoiceNumber" placeholder="NF" />
                <input name="bankName" placeholder="Banco do pagamento" />
                <input name="paymentDate" type="date" required />
                <input name="amount" type="number" step="0.01" placeholder="Valor" required className="md:col-span-2" />
                <button
                  disabled={loadingAction === 'manual-payment'}
                  className="rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-70 md:col-span-2"
                >
                  {loadingAction === 'manual-payment' ? 'Salvando...' : 'Cadastrar pagamento manual'}
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-semibold">Relatórios em Excel</h3>
              <p className="mt-2 text-sm text-slate-500">
                Baixe um arquivo por empresa com as colunas: Data, Referência, Valor, Banco e NF.
              </p>
              <div className="mt-5 space-y-3">
                {companies.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => window.open(`/api/reports/${c.id}`, '_blank')}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50"
                  >
                    <span>{c.display_name || c.legal_name}</span>
                    <FileDown className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Lista de pagamentos */}
        <section className="card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Lista de pagamentos</h2>
              <p className="text-sm text-slate-500">Clique em Editar para ajustar um registro diretamente na tabela.</p>
            </div>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full md:w-72"
            >
              <option value="all">Todas as empresas</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name || c.legal_name}</option>
              ))}
            </select>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-3 font-medium">Empresa</th>
                  <th className="px-3 py-3 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium">Referência</th>
                  <th className="px-3 py-3 font-medium">Valor</th>
                  <th className="px-3 py-3 font-medium">Banco</th>
                  <th className="px-3 py-3 font-medium">NF</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length ? (
                  filteredPayments.map((payment) => {
                    const isEditing = editingId === payment.id;
                    const isDeleting = deletingId === payment.id;
                    const isSaving = loadingAction === `edit-${payment.id}`;
                    const isRemoving = loadingAction === `delete-${payment.id}`;

                    return (
                      <tr
                        key={payment.id}
                        className={`border-b border-slate-100 last:border-0 transition-colors ${
                          isEditing ? 'bg-brand-50/60' : isDeleting ? 'bg-red-50/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Empresa (nunca editável) */}
                        <td className="px-3 py-3 font-medium text-slate-700">{payment.company_name}</td>

                        {/* Data */}
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editingData?.paymentDate ?? ''}
                              onChange={(e) => setEditingData((d) => d ? { ...d, paymentDate: e.target.value } : d)}
                              className="w-36 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            formatDate(payment.payment_date)
                          )}
                        </td>

                        {/* Referência */}
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <input
                              value={editingData?.reference ?? ''}
                              onChange={(e) => setEditingData((d) => d ? { ...d, reference: e.target.value } : d)}
                              className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            payment.reference
                          )}
                        </td>

                        {/* Valor */}
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editingData?.amount ?? ''}
                              onChange={(e) => setEditingData((d) => d ? { ...d, amount: e.target.value } : d)}
                              className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            formatCurrency(payment.amount)
                          )}
                        </td>

                        {/* Banco */}
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <input
                              value={editingData?.bankName ?? ''}
                              onChange={(e) => setEditingData((d) => d ? { ...d, bankName: e.target.value } : d)}
                              className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            payment.bank_name || '—'
                          )}
                        </td>

                        {/* NF */}
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <input
                              value={editingData?.invoiceNumber ?? ''}
                              onChange={(e) => setEditingData((d) => d ? { ...d, invoiceNumber: e.target.value } : d)}
                              className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            payment.invoice_number || '—'
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              STATUS_CLASS[payment.extraction_status] ?? 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {STATUS_LABEL[payment.extraction_status] ?? payment.extraction_status}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="px-3 py-3">
                          {isEditing ? (
                            // Modo edição: confirmar ou cancelar
                            <div className="flex items-center gap-2">
                              <button
                                onClick={saveEditing}
                                disabled={isSaving}
                                title="Salvar"
                                className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-500 disabled:opacity-60"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={cancelEditing}
                                title="Cancelar"
                                className="rounded-lg bg-slate-200 p-1.5 text-slate-700 hover:bg-slate-300"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : isDeleting ? (
                            // Modo confirmação de exclusão
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-600 font-medium">Excluir?</span>
                              <button
                                onClick={() => deletePayment(payment.id)}
                                disabled={isRemoving}
                                title="Confirmar exclusão"
                                className="rounded-lg bg-red-600 p-1.5 text-white hover:bg-red-500 disabled:opacity-60"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={cancelDelete}
                                title="Cancelar"
                                className="rounded-lg bg-slate-200 p-1.5 text-slate-700 hover:bg-slate-300"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            // Modo normal: editar e excluir
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startEditing(payment)}
                                title="Editar"
                                className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-brand-100 hover:text-brand-700"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => confirmDelete(payment.id)}
                                title="Excluir"
                                className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-red-100 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={8}>
                      Nenhum pagamento encontrado para o filtro atual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {/* Modal: pergunta se quer relançar o pagamento excluído */}
      {reuploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-slate-900">Lançamento excluído</h3>
            <p className="mt-2 text-sm text-slate-600">
              O pagamento <span className="font-medium">"{reuploadModal.fileName}"</span> foi excluído.
              Gostaria de lançar novamente?
            </p>

            <form onSubmit={handleReupload} className="mt-5 space-y-4">
              <input type="hidden" name="companyId" value={reuploadModal.companyId} />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Empresa: <span className="font-medium text-slate-800">{reuploadModal.companyName}</span>
              </div>
              <input type="file" name="file" accept="application/pdf" required />

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loadingAction === 'reupload'}
                  className="flex-1 rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-500 disabled:opacity-70"
                >
                  {loadingAction === 'reupload' ? 'Enviando...' : 'Sim, lançar novamente'}
                </button>
                <button
                  type="button"
                  onClick={() => setReuploadModal(null)}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Não
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
