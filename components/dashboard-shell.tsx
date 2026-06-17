'use client';

import { useState, useMemo, useCallback, FormEvent } from 'react';
import { Plus, Download, Upload, Trash2, Edit2, Eye, Calendar } from 'lucide-react';

type Tab = 'payments' | 'batch-upload' | 'reports' | 'settings';

interface Payment {
  id: string;
  company_name: string;
  reference: string;
  amount: number | null;
  bank_name: string | null;
  payment_date: string | null;
  status: string;
}

export default function DashboardShell() {
  const [activeTab, setActiveTab] = useState<Tab>('payments');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [batchFiles, setBatchFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);

  // Mock data - substituir com dados reais do Supabase
  const payments: Payment[] = [
    {
      id: '1',
      company_name: 'CGH Campo Novo',
      reference: 'Coleta de residuos - NORTE AMBIENTAL',
      amount: 350.00,
      bank_name: 'ITAU UNIBANCO S A',
      payment_date: '2026-06-05',
      status: 'processed'
    },
    {
      id: '2',
      company_name: 'CGH Campo Novo',
      reference: 'Seguro de Vida USINA - 15.06',
      amount: 82.47,
      bank_name: 'SANTANDER BRASIL S',
      payment_date: '2026-06-15',
      status: 'processed'
    }
  ];

  const companies = [
    { id: '1', name: 'CGH Campo Novo' },
    { id: '2', name: 'Empresa B' }
  ];

  const handleBatchUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!batchFiles || !selectedCompany) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('companyId', selectedCompany);
    for (let i = 0; i < batchFiles.length; i++) {
      formData.append('files', batchFiles[i]);
    }

    try {
      const response = await fetch('/api/payments/upload-batch', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      console.log('Upload result:', data);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'payments', label: 'Pagamentos', icon: <Eye className="w-4 h-4" /> },
    { id: 'batch-upload', label: 'Upload em Lote', icon: <Upload className="w-4 h-4" /> },
    { id: 'reports', label: 'Relatórios', icon: <Download className="w-4 h-4" /> },
    { id: 'settings', label: 'Configurações', icon: <Plus className="w-4 h-4" /> }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="border-b border-border bg-gradient-to-r from-primary/5 to-primary-dark/5 px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">Gestão de Pagamentos</h1>
          <p className="text-muted-foreground">Controle, visualize e administre todos os seus comprovantes em um único lugar</p>
        </div>
      </section>

      {/* Tabs Navigation */}
      <section className="border-b border-border sticky top-16 z-40 bg-card backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              {/* Filters Card */}
              <div className="card space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Filtros</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Empresa</label>
                    <select
                      value={selectedCompany}
                      onChange={(e) => setSelectedCompany(e.target.value)}
                      className="input"
                    >
                      <option value="">Todas as empresas</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> De
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Até
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div className="flex items-end">
                    <button className="btn btn-primary w-full">
                      Limpar filtros
                    </button>
                  </div>
                </div>
              </div>

              {/* Payments Table */}
              <div className="card overflow-hidden">
                <h2 className="text-lg font-semibold text-foreground mb-4">Lista de Pagamentos</h2>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Empresa</th>
                        <th>Data de Pgt</th>
                        <th>Referência</th>
                        <th>Valor</th>
                        <th>Banco</th>
                        <th>Status</th>
                        <th className="text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-muted-foreground">
                            Nenhum pagamento encontrado
                          </td>
                        </tr>
                      ) : (
                        payments.map((p) => (
                          <tr key={p.id}>
                            <td className="font-medium">{p.company_name}</td>
                            <td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString('pt-BR') : '—'}</td>
                            <td className="max-w-xs truncate text-sm">{p.reference}</td>
                            <td className="font-medium text-primary">
                              {p.amount ? `R$ ${p.amount.toFixed(2).replace('.', ',')}` : '—'}
                            </td>
                            <td className="text-sm">{p.bank_name || '—'}</td>
                            <td>
                              <span className="badge badge-success">
                                <span className="w-2 h-2 rounded-full bg-current" />
                                Processado
                              </span>
                            </td>
                            <td className="text-right">
                              <div className="flex justify-end gap-2">
                                <button className="p-2 hover:bg-surface rounded-lg transition-colors" title="Editar">
                                  <Edit2 className="w-4 h-4 text-primary" />
                                </button>
                                <button className="p-2 hover:bg-surface rounded-lg transition-colors" title="Excluir">
                                  <Trash2 className="w-4 h-4 text-error" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Batch Upload Tab */}
          {activeTab === 'batch-upload' && (
            <div className="space-y-6">
              <div className="card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Upload em Lote</h2>
                    <p className="text-sm text-muted-foreground">Envie até 10 PDFs de uma vez. Duplicados são detectados automaticamente.</p>
                  </div>
                </div>

                <form onSubmit={handleBatchUpload} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Empresa</label>
                      <select
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                        required
                        className="input"
                      >
                        <option value="">Selecione a empresa</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Arquivos PDF</label>
                      <input
                        type="file"
                        accept="application/pdf"
                        multiple
                        onChange={(e) => setBatchFiles(e.target.files)}
                        className="input"
                      />
                      {batchFiles && batchFiles.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {batchFiles.length} arquivo{batchFiles.length > 1 ? 's' : ''} selecionado{batchFiles.length > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !batchFiles || batchFiles.length === 0}
                    className="btn btn-primary w-full md:w-auto"
                  >
                    {loading ? 'Processando...' : 'Enviar lote'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Relatórios</h2>
              <p className="text-muted-foreground">Funcionalidade em desenvolvimento...</p>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Configurações</h2>
              <p className="text-muted-foreground">Funcionalidade em desenvolvimento...</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
