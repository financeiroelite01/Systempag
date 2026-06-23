'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, FileDown, FilePlus2, LayoutDashboard, LogOut, Pencil, Trash2, Upload, X } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

type DashboardTab = 'dashboard' | 'companies' | 'uploads' | 'manual' | 'reconciliation';

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
  processed: 'badge bg-emerald-50 text-emerald-600',
  pending:   'badge bg-slate-100 text-slate-500',
  review:    'badge bg-amber-50 text-amber-600',
  error:     'badge bg-red-50 text-red-600'
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
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Estado de edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<EditingPayment | null>(null);

  // Estado de confirmação de exclusão
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal de reupload após exclusão: guarda fileName e companyId do pagamento excluído
  const [reuploadModal, setReuploadModal] = useState<{ fileName: string; companyId: string; companyName: string } | null>(null);

  // ─── Navegação por sidebar ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');

  // ─── Exclusão em lote ────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // ─── Edição de empresa ────────────────────────────────────────────────────────
  type EditingCompany = { id: string; legalName: string; displayName: string; taxId: string };
  const [editingCompany, setEditingCompany] = useState<EditingCompany | null>(null);
  const [deleteCompanyId, setDeleteCompanyId] = useState<string | null>(null);

  // Upload em lote
  type BatchFileResult = {
    fileName: string;
    status: 'success' | 'duplicate' | 'error';
    message: string;
    reference?: string;
    amount?: number | null;
    bank_name?: string | null;
    payment_date?: string | null;
  };
  type BatchSummary = { total: number; success: number; duplicates: number; errors: number };
  const [batchCompany, setBatchCompany] = useState<string>('');
  const [batchFiles, setBatchFiles] = useState<FileList | null>(null);
  const [batchResults, setBatchResults] = useState<BatchFileResult[] | null>(null);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);

  // ─── Conciliação bancária ────────────────────────────────────────────────────
  type ReconciliationItem = {
    status: 'matched' | 'partial' | 'statement_only' | 'payment_only';
    statementRow: { date: string; amount: number; description: string } | null;
    payment: {
      id: string; reference: string; amount: number | null;
      payment_date: string | null; bank_name: string | null; invoice_number: string | null;
    } | null;
    matchScore: number;
    matchDetails: string[];
    divergences: string[];
  };
  type ReconciliationSummary = {
    total: number; matched: number; partial: number; statementOnly: number; paymentOnly: number;
  };
  const [reconcileCompany, setReconcileCompany] = useState<string>('');
  const [reconcileFile, setReconcileFile] = useState<File | null>(null);
  const [reconcileStartDate, setReconcileStartDate] = useState<string>('');
  const [reconcileEndDate, setReconcileEndDate] = useState<string>('');
  const [reconcileResults, setReconcileResults] = useState<ReconciliationItem[] | null>(null);
  const [reconcileSummary, setReconcileSummary] = useState<ReconciliationSummary | null>(null);
  const [reconcileFilter, setReconcileFilter] = useState<'all' | 'matched' | 'partial' | 'statement_only' | 'payment_only'>('all');

  // ─── Ordenação da lista de pagamentos ────────────────────────────────────────
  type SortField = 'payment_date' | 'company_name' | 'amount';
  type SortDir   = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('payment_date');
  const [sortDir,   setSortDir]   = useState<SortDir>('desc');

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'payment_date' ? 'desc' : 'asc');
    }
  }

  const filteredPayments = useMemo(() => {
    const filtered = payments.filter((p) => {
      if (selectedCompany !== 'all' && p.company_id !== selectedCompany) return false;
      if (startDate && (!p.payment_date || p.payment_date < startDate)) return false;
      if (endDate && (!p.payment_date || p.payment_date > endDate)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      if (sortField === 'payment_date') {
        aVal = a.payment_date ?? '';
        bVal = b.payment_date ?? '';
      } else if (sortField === 'company_name') {
        aVal = a.company_name.toLowerCase();
        bVal = b.company_name.toLowerCase();
      } else if (sortField === 'amount') {
        aVal = Number(a.amount ?? 0);
        bVal = Number(b.amount ?? 0);
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [payments, selectedCompany, startDate, endDate, sortField, sortDir]);

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

  // ─── Upload em lote ─────────────────────────────────────────────────────────────
  async function handleBatchUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!batchFiles || batchFiles.length === 0 || !batchCompany) return;

    setLoadingAction('batch');
    setBatchResults(null);
    setBatchSummary(null);

    const form = new FormData();
    form.append('companyId', batchCompany);
    for (let i = 0; i < batchFiles.length; i++) {
      form.append('files', batchFiles[i]);
    }

    const response = await fetch('/api/payments/upload-batch', {
      method: 'POST',
      body: form
    });

    const data = await response.json();
    setLoadingAction(null);

    if (!response.ok) {
      showFeedback(data.message || 'Erro no upload em lote.', 'error');
      return;
    }

    setBatchResults(data.results);
    setBatchSummary(data.summary);
    setBatchFiles(null);

    // Reset do input de arquivo
    const fileInput = document.querySelector<HTMLInputElement>('input[name="batch-files"]');
    if (fileInput) fileInput.value = '';

    if (data.summary.success > 0) await refreshPayments();
  }

  // ─── Conciliação bancária ────────────────────────────────────────────────────
  async function handleReconcile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reconcileFile || !reconcileCompany) return;
    setLoadingAction('reconcile');
    setReconcileResults(null);
    setReconcileSummary(null);

    const form = new FormData();
    form.append('file', reconcileFile);
    form.append('companyId', reconcileCompany);
    if (reconcileStartDate) form.append('startDate', reconcileStartDate);
    if (reconcileEndDate) form.append('endDate', reconcileEndDate);

    const response = await fetch('/api/reconciliation', { method: 'POST', body: form });
    const data = await response.json();
    setLoadingAction(null);

    if (!response.ok) { showFeedback(data.message || 'Erro na conciliação.', 'error'); return; }
    setReconcileResults(data.results);
    setReconcileSummary(data.summary);
    setReconcileFilter('all');
  }

  async function handleReconcileExport() {
    if (!reconcileResults) return;
    setLoadingAction('reconcile-export');
    const companyName = companies.find(c => c.id === reconcileCompany)?.display_name
      || companies.find(c => c.id === reconcileCompany)?.legal_name || 'Empresa';

    const response = await fetch('/api/reconciliation/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: reconcileResults, companyName }),
    });

    if (!response.ok) { showFeedback('Erro ao exportar.', 'error'); setLoadingAction(null); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyName}-conciliacao.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
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

  // ─── Edição de empresa ────────────────────────────────────────────────────────
  async function handleSaveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCompany) return;
    setLoadingAction('company-edit');

    const response = await fetch(`/api/companies/${editingCompany.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legalName:   editingCompany.legalName,
        displayName: editingCompany.displayName,
        taxId:       editingCompany.taxId,
      }),
    });

    const data = await response.json();
    showFeedback(data.message, response.ok ? 'success' : 'error');
    setLoadingAction(null);
    if (response.ok) { setEditingCompany(null); router.refresh(); }
  }

  async function handleDeleteCompany() {
    if (!deleteCompanyId) return;
    setLoadingAction('company-delete');

    const response = await fetch(`/api/companies/${deleteCompanyId}`, { method: 'DELETE' });
    const data = await response.json();
    showFeedback(data.message, response.ok ? 'success' : 'error');
    setLoadingAction(null);
    setDeleteCompanyId(null);
    if (response.ok) router.refresh();
  }

  // ─── Exclusão em lote ────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredPayments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPayments.map(p => p.id)));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setLoadingAction('bulk-delete');
    setBulkDeleteConfirm(false);

    const ids = Array.from(selectedIds);
    const results = await Promise.all(
      ids.map(id =>
        fetch(`/api/payments/${id}`, { method: 'DELETE' })
          .then(r => ({ id, ok: r.ok }))
          .catch(() => ({ id, ok: false }))
      )
    );

    const failed = results.filter(r => !r.ok).length;
    const succeeded = results.filter(r => r.ok).length;
    setSelectedIds(new Set());
    setLoadingAction(null);

    if (failed > 0) {
      showFeedback(`${succeeded} excluído(s), ${failed} com erro.`, 'error');
    } else {
      showFeedback(`${succeeded} pagamento(s) excluído(s) com sucesso.`, 'success');
    }
    await refreshPayments();
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  const navItems: { id: DashboardTab; label: string; icon: typeof LayoutDashboard; description: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Visão geral e pagamentos' },
    { id: 'companies', label: 'Cadastrar empresa', icon: Building2, description: 'Empresas e upload individual' },
    { id: 'uploads', label: 'Uploads', icon: Upload, description: 'PDF individual e em lote' },
    { id: 'manual', label: 'Cadastro manual', icon: FilePlus2, description: 'Lançar pagamento sem PDF' },
    { id: 'reconciliation', label: 'Conciliação bancária', icon: FileDown, description: 'Comparar extrato com comprovantes' },
  ];

  return (
    <main className="flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside className="hidden w-60 flex-shrink-0 flex-col lg:flex" style={{background:"var(--sidebar-bg)"}}>
        <div className="flex h-16 items-center gap-3 px-5 border-b" style={{borderColor:"rgba(255,255,255,0.08)"}}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{background:"var(--accent)"}}>
            <span className="text-xs font-bold text-white tracking-wider">SP</span>
          </div>
          <span className="text-sm font-semibold tracking-tight" style={{color:"#FFFFFF"}}>Systempag</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all rounded-lg relative"
                style={{
                  background: isActive ? 'rgba(37,99,235,0.15)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--sidebar-text)',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <Icon className="h-4 w-4 flex-shrink-0 flex-none" style={{color: isActive ? "#60A5FA" : "var(--sidebar-text)"}} />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-none">{item.label}</p>
                  <p className="text-xs mt-0.5 truncate" style={{color:"var(--sidebar-text)", opacity:0.7}}>{item.description}</p>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t" style={{borderColor:"rgba(255,255,255,0.08)"}}>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all" style={{color:"var(--sidebar-text)"}} onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.05)"} onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background="transparent"}
          >
            <LogOut className="h-4 w-4" />
            {loadingAction === 'logout' ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </aside>

      {/* ── Conteúdo principal ── */}
      <div className="flex-1 overflow-x-hidden flex flex-col min-h-screen">
        <header className="border-b bg-white lg:hidden" style={{borderColor:"var(--card-border)"}}>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <span className="badge">Dashboard financeiro</span>
              <h1 className="mt-3 text-2xl font-semibold text-slate-900">Gestão de pagamentos por empresa</h1>
              <p className="mt-1 text-sm text-slate-500">Usuário logado: {userEmail}</p>
            </div>
            <button
              onClick={signOut}
              className="btn btn-secondary"
            >
              <LogOut className="h-4 w-4" />
              {loadingAction === 'logout' ? 'Saindo...' : 'Sair'}
            </button>
          </div>

          {/* Nav mobile (tabs horizontais) */}
          <div className="flex gap-1.5 overflow-x-auto px-5 pb-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === item.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        {/* Header desktop simplificado */}
        <header className="hidden border-b bg-white lg:block" style={{borderColor:"var(--card-border)"}}>
          <div className="px-8 py-5 flex items-center justify-between">
            <h1 className="text-lg font-semibold" style={{color:"var(--text-primary)"}}>
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
            <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>{userEmail}</p>
          </div>
        </header>

      <section className="space-y-6 px-6 py-6 lg:px-8 flex-1">
        {/* Feedback global (sempre visível, independente da aba) */}
        {feedback && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm font-medium animate-in ${
              feedback.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* ═══ ABA: DASHBOARD ═══ */}
        {activeTab === 'dashboard' && (
        <>
        {/* Cards de resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <p className="text-xs font-medium uppercase tracking-widest" style={{color:"var(--text-muted)"}}>Empresas</p>
            <p className="mt-2 text-3xl font-semibold text-money">{companies.length}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-medium uppercase tracking-widest" style={{color:"var(--text-muted)"}}>Pagamentos</p>
            <p className="mt-2 text-3xl font-semibold text-money">{filteredPayments.length}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-medium uppercase tracking-widest" style={{color:"var(--text-muted)"}}>Valor total</p>
            <p className="mt-3 text-4xl font-semibold">{formatCurrency(totalAmount)}</p>
            <p className="mt-2 text-sm text-emerald-600">Processados automaticamente: {processedCount}</p>
          </div>
        </div>

        </>
        )}

        {/* ═══ ABA: CADASTRAR EMPRESA ═══ */}
        {activeTab === 'companies' && (
        <>
        {/* Formulário: cadastrar empresa */}
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="card p-6 animate-in">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2.5 flex-shrink-0" style={{background:"var(--accent-light)",color:"var(--accent)"}}>
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{color:"var(--text-primary)"}}>Cadastrar empresa</h2>
                <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>Cada pagamento ficará vinculado a uma empresa.</p>
              </div>
            </div>
            <form onSubmit={handleCreateCompany} className="mt-6 grid gap-4 md:grid-cols-2">
              <input name="legalName" placeholder="Razão social" required />
              <input name="displayName" placeholder="Nome de exibição" />
              <input name="taxId" placeholder="CNPJ" className="md:col-span-2" />
              <button
                disabled={loadingAction === 'company'}
                className="btn btn-primary md:col-span-2 w-full justify-center py-2.5"
              >
                {loadingAction === 'company' ? 'Salvando...' : 'Salvar empresa'}
              </button>
            </form>
          </section>

          {/* Lista de empresas cadastradas */}
          <section className="card p-6 animate-in">
            <div className="flex items-center gap-3 mb-5">
              <div className="rounded-lg p-2.5 flex-shrink-0" style={{background:"var(--accent-light)",color:"var(--accent)"}}>
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{color:"var(--text-primary)"}}>Empresas cadastradas</h2>
                <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>{companies.length} empresa(s) no total.</p>
              </div>
            </div>

            {companies.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{color:"var(--text-muted)"}}>Nenhuma empresa cadastrada ainda.</p>
            ) : (
              <div className="space-y-2">
                {companies.map((c) => (
                  <div key={c.id}>
                    {/* Modo visualização */}
                    {editingCompany?.id !== c.id ? (
                      <div className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-slate-50" style={{borderColor:"var(--card-border)"}}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{color:"var(--text-primary)"}}>{c.display_name || c.legal_name}</p>
                          {c.display_name && (
                            <p className="text-xs truncate mt-0.5" style={{color:"var(--text-muted)"}}>{c.legal_name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                          <button
                            onClick={() => setEditingCompany({
                              id: c.id,
                              legalName: c.legal_name,
                              displayName: c.display_name ?? '',
                              taxId: '',
                            })}
                            className="btn-icon btn-ghost"
                            title="Editar empresa"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteCompanyId(c.id)}
                            className="btn-icon btn-ghost"
                            title="Excluir empresa"
                            style={{color:"var(--danger)"}}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--danger-bg)"}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = ""}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Modo edição inline */
                      <form
                        onSubmit={handleSaveCompany}
                        className="rounded-lg border-2 p-4 space-y-3"
                        style={{borderColor:"var(--accent)", background:"var(--accent-light)"}}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{color:"var(--accent)"}}>Editando empresa</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            required
                            placeholder="Razão social"
                            value={editingCompany.legalName}
                            onChange={e => setEditingCompany(prev => prev ? {...prev, legalName: e.target.value} : null)}
                          />
                          <input
                            placeholder="Nome de exibição"
                            value={editingCompany.displayName}
                            onChange={e => setEditingCompany(prev => prev ? {...prev, displayName: e.target.value} : null)}
                          />
                          <input
                            placeholder="CNPJ"
                            value={editingCompany.taxId}
                            onChange={e => setEditingCompany(prev => prev ? {...prev, taxId: e.target.value} : null)}
                            className="md:col-span-2"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="submit"
                            disabled={loadingAction === 'company-edit'}
                            className="btn btn-primary"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {loadingAction === 'company-edit' ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCompany(null)}
                            className="btn btn-secondary"
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancelar
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        </>
        )}

        {/* ═══ ABA: UPLOADS ═══ */}
        {activeTab === 'uploads' && (
        <>
        {/* Upload individual */}
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="card p-6 animate-in">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2.5 flex-shrink-0" style={{background:"var(--accent-light)",color:"var(--accent)"}}>
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{color:"var(--text-primary)"}}>Upload de comprovante PDF</h2>
                <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>
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
                className="btn btn-primary w-full justify-center py-2.5"
              >
                {loadingAction === 'upload' ? 'Processando PDF...' : 'Enviar PDF e extrair dados'}
              </button>
            </form>
          </section>
        </div>

        {/* Upload em lote */}
        <section className="card p-6 animate-in">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2.5 flex-shrink-0" style={{background:"var(--accent-light)",color:"var(--accent)"}}>
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{color:"var(--text-primary)"}}>Upload em lote</h2>
              <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>Envie até 10 comprovantes PDF de uma vez. Duplicados são detectados automaticamente.</p>
            </div>
          </div>

          <form onSubmit={handleBatchUpload} className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={batchCompany}
                onChange={(e) => setBatchCompany(e.target.value)}
                required
                className="md:col-span-2"
              >
                <option value="" disabled>Selecione a empresa</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.display_name || c.legal_name}</option>
                ))}
              </select>
              <div className="md:col-span-2">
                <input
                  type="file"
                  name="batch-files"
                  accept="application/pdf"
                  multiple
                  required
                  onChange={(e) => setBatchFiles(e.target.files)}
                />
                {batchFiles && batchFiles.length > 0 && (
                  <p className="mt-2 text-sm text-slate-500">
                    {batchFiles.length} arquivo{batchFiles.length > 1 ? 's' : ''} selecionado{batchFiles.length > 1 ? 's' : ''}
                    {batchFiles.length > 10 && (
                      <span className="ml-2 font-medium text-red-600">— máximo 10 arquivos</span>
                    )}
                  </p>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={loadingAction === 'batch' || !batchFiles || batchFiles.length === 0 || batchFiles.length > 10}
              className="btn btn-primary self-end"
            >
              {loadingAction === 'batch' ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Processando...
                </span>
              ) : 'Enviar lote'}
            </button>
          </form>

          {/* Resultado do lote */}
          {batchSummary && (
            <div className="mt-6 space-y-4">
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-3">
                <div className="card p-4 text-center border-emerald-100">
                  <p className="text-2xl font-semibold text-money" style={{color:"var(--success)"}}>{batchSummary.success}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide" style={{color:"var(--success)"}}>Processados</p>
                </div>
                <div className="card p-4 text-center border-amber-100">
                  <p className="text-2xl font-semibold text-money" style={{color:"var(--warning)"}}>{batchSummary.duplicates}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide" style={{color:"var(--warning)"}}>Duplicados</p>
                </div>
                <div className="card p-4 text-center border-red-100">
                  <p className="text-2xl font-semibold text-money" style={{color:"var(--danger)"}}>{batchSummary.errors}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide" style={{color:"var(--danger)"}}>Erros</p>
                </div>
              </div>

              {/* Lista detalhada */}
              <div className="card overflow-hidden">
                {batchResults?.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 ${
                      result.status === 'success' ? '' :
                      result.status === 'duplicate' ? 'bg-amber-50' : 'bg-red-50'
                    }`} style={{borderColor:"var(--card-border)"}}
                  >
                    <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      result.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                      result.status === 'duplicate' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {result.status === 'success' ? '✓' : result.status === 'duplicate' ? '=' : '✕'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{color:"var(--text-primary)"}}>{result.fileName}</p>
                      <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>{result.message}</p>
                      {result.status === 'success' && result.reference && (
                        <p className="mt-0.5 text-xs" style={{color:"var(--text-muted)"}}>
                          {result.reference}
                          {result.amount ? ` · R$ ${Number(result.amount).toFixed(2).replace('.', ',')}` : ''}
                          {result.bank_name ? ` · ${result.bank_name}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
        </>
        )}

        {/* ═══ ABA: CADASTRO MANUAL ═══ */}
        {activeTab === 'manual' && (
        <>
        {/* Cadastro manual + relatórios */}
        <section className="card p-6 animate-in">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2.5 flex-shrink-0" style={{background:"#F1F4F8",color:"var(--text-secondary)"}}>
                  <FilePlus2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold" style={{color:"var(--text-primary)"}}>Cadastro manual</h2>
                  <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>Útil para ajustes quando o PDF não trouxer todos os campos.</p>
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
                  className="btn btn-primary md:col-span-2 w-full justify-center py-2.5"
                >
                  {loadingAction === 'manual-payment' ? 'Salvando...' : 'Cadastrar pagamento manual'}
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-semibold">Relatórios em Excel</h3>
              <p className="mt-2 text-sm text-slate-500">
                Baixe um arquivo por empresa com as colunas: Data de Pgt, Referência, Valor, Banco e NF. Use o filtro de período abaixo para gerar relatórios mês a mês.
              </p>
              <div className="mt-5 space-y-3">
                {companies.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (startDate) params.set('start', startDate);
                      if (endDate) params.set('end', endDate);
                      const query = params.toString();
                      window.open(`/api/reports/${c.id}${query ? `?${query}` : ''}`, '_blank');
                    }}
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
        </>
        )}

        {/* ═══ ABA: CONCILIAÇÃO BANCÁRIA ═══ */}
        {activeTab === 'reconciliation' && (
        <>
        {/* Conciliação Bancária */}
        <section className="card p-6 animate-in">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2.5 flex-shrink-0" style={{background:"var(--accent-light)",color:"var(--accent)"}}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{color:"var(--text-primary)"}}>Conciliação bancária</h2>
              <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>Importe o extrato CSV do banco e compare automaticamente com os comprovantes cadastrados.</p>
            </div>
          </div>

          <form onSubmit={handleReconcile} className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Empresa</label>
              <select value={reconcileCompany} onChange={e => setReconcileCompany(e.target.value)} required>
                <option value="" disabled>Selecione a empresa</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.display_name || c.legal_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Extrato do banco (CSV ou Excel)</label>
              <input type="file" accept=".csv,.txt,.xls,.xlsx" required
                onChange={e => setReconcileFile(e.target.files?.[0] ?? null)} />
              <p className="mt-1 text-xs text-slate-400">Formatos aceitos: .csv, .txt, .xls, .xlsx</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Período — De</label>
              <input type="date" value={reconcileStartDate} onChange={e => setReconcileStartDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Período — Até</label>
              <input type="date" value={reconcileEndDate} onChange={e => setReconcileEndDate(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <button type="submit"
                disabled={loadingAction === 'reconcile' || !reconcileFile || !reconcileCompany}
                className="btn btn-primary">
                {loadingAction === 'reconcile' ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Conciliando...
                  </span>
                ) : 'Conciliar extrato'}
              </button>
            </div>
          </form>

          {/* Resultado da conciliação */}
          {reconcileSummary && reconcileResults && (
            <div className="mt-8 space-y-6">
              {/* Cards de resumo */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: 'Conciliados', value: reconcileSummary.matched, color: 'bg-emerald-50 text-emerald-700', filter: 'matched' as const },
                  { label: 'Parciais', value: reconcileSummary.partial, color: 'bg-amber-50 text-amber-700', filter: 'partial' as const },
                  { label: 'Só no extrato', value: reconcileSummary.statementOnly, color: 'bg-red-50 text-red-700', filter: 'statement_only' as const },
                  { label: 'Só no sistema', value: reconcileSummary.paymentOnly, color: 'bg-slate-50 text-slate-700', filter: 'payment_only' as const },
                ].map(card => (
                  <button key={card.filter}
                    onClick={() => setReconcileFilter(reconcileFilter === card.filter ? 'all' : card.filter)}
                    className={`card p-4 text-center cursor-pointer transition-all ${reconcileFilter === card.filter ? 'ring-2 ring-blue-300' : 'hover:shadow-md'}`}>
                    <p className="text-2xl font-bold text-money">{card.value}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide" style={{color:"var(--text-muted)"}}>{card.label}</p>
                  </button>
                ))}
              </div>

              {/* Botão exportar */}
              <div className="flex items-center justify-between">
                <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>
                  {reconcileFilter === 'all'
                    ? `${reconcileResults.length} registros no total`
                    : `Filtrando: ${reconcileResults.filter(r => r.status === reconcileFilter).length} registros`}
                </p>
                <button onClick={handleReconcileExport}
                  disabled={loadingAction === 'reconcile-export'}
                  className="btn btn-secondary" style={{color:"var(--accent)",borderColor:"#BFDBFE",background:"var(--accent-light)"}}>
                  <FileDown className="h-4 w-4" />
                  {loadingAction === 'reconcile-export' ? 'Exportando...' : 'Exportar Excel'}
                </button>
              </div>

              {/* Tabela de resultados */}
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="">
                        <th >Status</th>
                        <th >Data</th>
                        <th >Valor extrato</th>
                        <th >Valor comprovante</th>
                        <th >Referência</th>
                        <th >Descrição extrato</th>
                        <th >Score</th>
                        <th >Obs.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconcileResults
                        .filter(r => reconcileFilter === 'all' || r.status === reconcileFilter)
                        .map((r, i) => {
                          const statusConfig = {
                            matched:        { label: '✓ Conciliado',      cls: 'badge bg-emerald-50 text-emerald-700' },
                            partial:        { label: '⚠ Parcial',         cls: 'badge bg-amber-50 text-amber-700'   },
                            statement_only: { label: '✕ Só no extrato',   cls: 'badge bg-red-50 text-red-700'       },
                            payment_only:   { label: '✕ Só no sistema',   cls: 'badge bg-slate-100 text-slate-600'   },
                          }[r.status];

                          const stmtDate = r.statementRow?.date
                            ? r.statementRow.date.split('-').reverse().join('/') : '—';
                          const payDate = r.payment?.payment_date
                            ? r.payment.payment_date.split('-').reverse().join('/') : '—';
                          const date = r.statementRow ? stmtDate : payDate;

                          return (
                            <tr key={i} className="">
                              <td className="px-4 py-3">
                                <span className={statusConfig.cls}>
                                  {statusConfig.label}
                                </span>
                              </td>
                              <td className="text-money" style={{color:"var(--text-secondary)"}}>{date}</td>
                              <td className="font-medium text-money">
                                {r.statementRow ? `R$ ${Math.abs(r.statementRow.amount).toFixed(2).replace('.', ',')}` : '—'}
                              </td>
                              <td className="font-medium text-money">
                                {r.payment?.amount != null ? `R$ ${Number(r.payment.amount).toFixed(2).replace('.', ',')}` : '—'}
                              </td>
                              <td className="max-w-[200px] truncate" style={{color:"var(--text-primary)"}}>
                                {r.payment?.reference || '—'}
                              </td>
                              <td className="max-w-[200px] truncate" style={{color:"var(--text-muted)"}}>
                                {r.statementRow?.description || '—'}
                              </td>
                              <td className="px-4 py-3">
                                {r.matchScore > 0 && (
                                  <div className="flex items-center gap-2">
                                    <div className="h-1 w-14 overflow-hidden rounded-full bg-slate-100">
                                      <div className={`h-full rounded-full ${r.matchScore >= 95 ? 'bg-emerald-500' : r.matchScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                        style={{ width: `${r.matchScore}%` }} />
                                    </div>
                                    <span className="text-xs text-slate-500">{r.matchScore}%</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {r.divergences.length > 0 && (
                                  <span className="text-xs text-slate-400" title={r.divergences.join(' | ')}>
                                    {r.divergences[0].length > 40 ? r.divergences[0].slice(0, 40) + '…' : r.divergences[0]}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
        </>
        )}

        {/* Lista de pagamentos — também faz parte da aba Dashboard */}
        {activeTab === 'dashboard' && (
        <section className="card p-6 animate-in">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold" style={{color:"var(--text-primary)"}}>Lista de pagamentos</h2>
              <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>Clique em Editar para ajustar um registro diretamente na tabela.</p>
            </div>
            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500 whitespace-nowrap">De</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setSelectedIds(new Set()); }}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <label className="text-sm text-slate-500 whitespace-nowrap">até</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setSelectedIds(new Set()); }}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => { setStartDate(''); setEndDate(''); setSelectedIds(new Set()); }}
                    className="text-sm font-medium text-brand-700 hover:underline whitespace-nowrap"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <select
                value={selectedCompany}
                onChange={(e) => { setSelectedCompany(e.target.value); setSelectedIds(new Set()); }}
                className="w-full md:w-72"
              >
                <option value="all">Todas as empresas</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.display_name || c.legal_name}</option>
                ))}
              </select>

              {/* Botão exportar relatório Excel */}
              {selectedCompany !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (startDate) params.set('start', startDate);
                    if (endDate) params.set('end', endDate);
                    const query = params.toString();
                    window.open(`/api/reports/${selectedCompany}${query ? `?${query}` : ''}`, '_blank');
                  }}
                  className="btn btn-secondary" style={{color:"var(--accent)",borderColor:"#BFDBFE",background:"var(--accent-light)"}}
                  title="Exportar relatório da empresa selecionada"
                >
                  <FileDown className="h-4 w-4" />
                  Exportar Excel
                </button>
              ) : (
                <div className="relative group">
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-500 whitespace-nowrap"
                  >
                    <FileDown className="h-4 w-4" />
                    Exportar Excel
                  </button>
                  {/* Dropdown com lista de empresas quando "Todas as empresas" está selecionado */}
                  <div className="absolute right-0 top-full z-20 mt-1 hidden w-56 rounded-2xl border border-slate-200 bg-white py-2 shadow-lg group-hover:block">
                    <p className="px-4 py-1 text-xs font-medium text-slate-400">Selecione a empresa:</p>
                    {companies.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams();
                          if (startDate) params.set('start', startDate);
                          if (endDate) params.set('end', endDate);
                          const query = params.toString();
                          window.open(`/api/reports/${c.id}${query ? `?${query}` : ''}`, '_blank');
                        }}
                        className="flex w-full items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                      >
                        <span>{c.display_name || c.legal_name}</span>
                        <FileDown className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            {/* Barra de ação em lote */}
            {selectedIds.size > 0 && (
              <div className="mb-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 animate-in">
                <span className="text-sm font-medium" style={{color:"var(--danger)"}}>
                  {selectedIds.size} pagamento(s) selecionado(s)
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-sm btn btn-ghost py-1.5"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setBulkDeleteConfirm(true)}
                    disabled={loadingAction === 'bulk-delete'}
                    className="btn btn-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                    {loadingAction === 'bulk-delete' ? 'Excluindo...' : `Excluir ${selectedIds.size} selecionado(s)`}
                  </button>
                </div>
              </div>
            )}

            <table className="data-table">
              <thead>
                <tr className="">
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={filteredPayments.length > 0 && selectedIds.size === filteredPayments.length}
                      ref={el => {
                        if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredPayments.length;
                      }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-brand-600"
                      title="Selecionar todos"
                    />
                  </th>
                  <th >
                    <button
                      onClick={() => handleSort('company_name')}
                      className="flex items-center gap-1 hover:text-slate-700 transition-colors"
                    >
                      Empresa
                      <span className="text-slate-300">
                        {sortField === 'company_name' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  </th>
                  <th >
                    <button
                      onClick={() => handleSort('payment_date')}
                      className="flex items-center gap-1 hover:text-slate-700 transition-colors"
                    >
                      Data de Pgt
                      <span className="text-slate-300">
                        {sortField === 'payment_date' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  </th>
                  <th >Referência</th>
                  <th >
                    <button
                      onClick={() => handleSort('amount')}
                      className="flex items-center gap-1 hover:text-slate-700 transition-colors"
                    >
                      Valor
                      <span className="text-slate-300">
                        {sortField === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  </th>
                  <th >Banco</th>
                  <th >NF</th>
                  <th >Status</th>
                  <th >Ações</th>
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
                        className={`transition-colors ${
                          selectedIds.has(payment.id) ? 'bg-red-50' :
                          isEditing ? 'bg-blue-50' : isDeleting ? 'bg-red-50' : ''
                        }`}
                      >
                        {/* Checkbox de seleção */}
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(payment.id)}
                            onChange={() => toggleSelect(payment.id)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-brand-600"
                          />
                        </td>

                        {/* Empresa (nunca editável) */}
                        <td className="font-medium whitespace-nowrap" style={{color:"var(--text-primary)"}}>{payment.company_name}</td>

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
                                className="btn-icon btn-ghost"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => confirmDelete(payment.id)}
                                title="Excluir"
                                className="btn-icon btn-ghost" style={{color:"var(--danger)"}} onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background="var(--danger-bg)"} onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background=""}
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
        )}
      </section>
      </div>

      {/* Modal: confirmação de exclusão de empresa */}
      {deleteCompanyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:"rgba(15,17,23,0.6)",backdropFilter:"blur(4px)"}}>
          <div className="card w-full max-w-md p-6 animate-in">
            <h3 className="text-base font-semibold" style={{color:"var(--text-primary)"}}>Excluir empresa</h3>
            <p className="mt-2 text-sm" style={{color:"var(--text-secondary)"}}>
              Tem certeza que deseja excluir esta empresa? Os pagamentos vinculados <strong>não serão excluídos</strong>, mas ficarão sem empresa associada.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={handleDeleteCompany}
                disabled={loadingAction === 'company-delete'}
                className="btn btn-danger flex-1 justify-center"
              >
                {loadingAction === 'company-delete' ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
              <button
                onClick={() => setDeleteCompanyId(null)}
                className="btn btn-secondary flex-1 justify-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmação de exclusão em lote */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:"rgba(15,17,23,0.6)",backdropFilter:"blur(4px)"}}>
          <div className="card w-full max-w-md p-6 animate-in">
            <h3 className="text-base font-semibold" style={{color:"var(--text-primary)"}}>Excluir pagamentos</h3>
            <p className="mt-2 text-sm" style={{color:"var(--text-secondary)"}}>
              Tem certeza que deseja excluir{' '}
              <span className="font-medium text-red-700">{selectedIds.size} pagamento(s)</span>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={handleBulkDelete}
                disabled={loadingAction === 'bulk-delete'}
                className="btn btn-danger flex-1 justify-center"
              >
                {loadingAction === 'bulk-delete' ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                className="btn btn-secondary flex-1 justify-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: pergunta se quer relançar o pagamento excluído */}
      {reuploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:"rgba(15,17,23,0.6)",backdropFilter:"blur(4px)"}}>
          <div className="card w-full max-w-md p-6 animate-in">
            <h3 className="text-base font-semibold" style={{color:"var(--text-primary)"}}>Lançamento excluído</h3>
            <p className="mt-2 text-sm" style={{color:"var(--text-secondary)"}}>
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
                  className="btn btn-secondary flex-1 justify-center"
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
