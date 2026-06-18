import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

type ReconciliationResult = {
  status: 'matched' | 'partial' | 'statement_only' | 'payment_only';
  statementRow: { date: string; amount: number; description: string } | null;
  payment: {
    id: string;
    reference: string;
    amount: number | null;
    payment_date: string | null;
    bank_name: string | null;
    invoice_number: string | null;
  } | null;
  matchScore: number;
  matchDetails: string[];
  divergences: string[];
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatAmount(value: number | null | undefined): string {
  if (value == null) return '';
  return `R$ ${Math.abs(value).toFixed(2).replace('.', ',')}`;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'matched': return '✓ Conciliado';
    case 'partial': return '⚠ Parcial';
    case 'statement_only': return '✕ Só no extrato';
    case 'payment_only': return '✕ Só no sistema';
    default: return status;
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const results: ReconciliationResult[] = body.results ?? [];
  const companyName: string = body.companyName ?? 'Empresa';

  // Montar linhas do Excel
  const rows = results.map(r => ({
    'Status': statusLabel(r.status),
    'Score (%)': r.matchScore,
    // Extrato
    'Data Extrato': formatDate(r.statementRow?.date ?? null),
    'Valor Extrato': r.statementRow ? formatAmount(r.statementRow.amount) : '',
    'Descrição Extrato': r.statementRow?.description ?? '',
    // Comprovante
    'Data Comprovante': formatDate(r.payment?.payment_date ?? null),
    'Valor Comprovante': formatAmount(r.payment?.amount ?? null),
    'Referência Comprovante': r.payment?.reference ?? '',
    'Banco': r.payment?.bank_name ?? '',
    'NF': r.payment?.invoice_number ?? '',
    // Diagnóstico
    'Correspondências': r.matchDetails.join(' | '),
    'Divergências': r.divergences.join(' | '),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Larguras de coluna
  ws['!cols'] = [
    { wch: 18 }, // Status
    { wch: 10 }, // Score
    { wch: 14 }, // Data Extrato
    { wch: 16 }, // Valor Extrato
    { wch: 35 }, // Descrição Extrato
    { wch: 18 }, // Data Comprovante
    { wch: 18 }, // Valor Comprovante
    { wch: 35 }, // Referência
    { wch: 22 }, // Banco
    { wch: 10 }, // NF
    { wch: 40 }, // Correspondências
    { wch: 50 }, // Divergências
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Conciliação');

  // Aba de resumo
  const matched = results.filter(r => r.status === 'matched').length;
  const partial = results.filter(r => r.status === 'partial').length;
  const stmtOnly = results.filter(r => r.status === 'statement_only').length;
  const payOnly = results.filter(r => r.status === 'payment_only').length;

  const summaryRows = [
    { 'Item': 'Empresa', 'Valor': companyName },
    { 'Item': 'Total de registros', 'Valor': results.length },
    { 'Item': '✓ Conciliados', 'Valor': matched },
    { 'Item': '⚠ Parciais (revisar)', 'Valor': partial },
    { 'Item': '✕ Só no extrato (falta comprovante)', 'Valor': stmtOnly },
    { 'Item': '✕ Só no sistema (falta no extrato)', 'Valor': payOnly },
    { 'Item': 'Taxa de conciliação', 'Valor': `${Math.round((matched / Math.max(results.length, 1)) * 100)}%` },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 35 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${companyName}-conciliacao-${date}.xlsx"`,
    },
  });
}
