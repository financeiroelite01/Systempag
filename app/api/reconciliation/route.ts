import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type StatementRow = {
  date: string;       // YYYY-MM-DD
  amount: number;     // positivo = crédito, negativo = débito
  description: string;
  raw: string;        // linha original do CSV
};

type ReconciliationResult = {
  status: 'matched' | 'partial' | 'statement_only' | 'payment_only';
  statementRow: StatementRow | null;
  payment: {
    id: string;
    reference: string;
    amount: number | null;
    payment_date: string | null;
    bank_name: string | null;
    invoice_number: string | null;
  } | null;
  matchScore: number;      // 0-100
  matchDetails: string[];  // ex: ['valor ✓', 'data ✓', 'descrição ≈']
  divergences: string[];   // ex: ['valor difere: R$350 ≠ R$360']
};

// ─── Parser de CSV ────────────────────────────────────────────────────────────

function parseCSV(text: string): StatementRow[] {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const rows: StatementRow[] = [];

  for (const line of lines) {
    // Tenta separar por ponto-e-vírgula (padrão BR) ou vírgula
    const sep = line.includes(';') ? ';' : ',';
    const cols = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());

    // Procura coluna de data (dd/mm/yyyy ou yyyy-mm-dd)
    let date: string | null = null;
    let amount: number | null = null;
    let description = '';

    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];

      // Data
      const ddmmyyyy = col.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const yyyymmdd = col.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ddmmyyyy && !date) {
        date = `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
      } else if (yyyymmdd && !date) {
        date = col;
      }

      // Valor (formato BR: "1.234,56" ou "-1234.56")
      const brValue = col.replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(brValue);
      if (!isNaN(parsed) && Math.abs(parsed) > 0.01 && amount === null) {
        // Só aceita se parecer um valor monetário razoável (> 0.01 e não um ano)
        if (Math.abs(parsed) < 10_000_000 && !col.match(/^\d{4}$/)) {
          amount = parsed;
        }
      }

      // Descrição: coluna de texto mais longa
      if (col.length > description.length && isNaN(parsed)) {
        description = col;
      }
    }

    // Só inclui linhas com data e valor válidos
    if (date && amount !== null) {
      rows.push({ date, amount, description, raw: line });
    }
  }

  return rows;
}

// ─── Normaliza texto para comparação ─────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Similaridade simples por palavras em comum
function similarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normalize(b).split(' ').filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let common = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) common++; });
  return common / Math.max(wordsA.size, wordsB.size);
}

// ─── Conciliação principal ────────────────────────────────────────────────────

function reconcile(
  statementRows: StatementRow[],
  payments: {
    id: string;
    reference: string;
    amount: number | null;
    payment_date: string | null;
    bank_name: string | null;
    invoice_number: string | null;
  }[]
): ReconciliationResult[] {
  const results: ReconciliationResult[] = [];
  const usedPaymentIds = new Set<string>();
  const usedStatementIndexes = new Set<number>();

  // Para cada linha do extrato, tenta encontrar um comprovante correspondente
  for (let si = 0; si < statementRows.length; si++) {
    const stmt = statementRows[si];
    const stmtAmount = Math.abs(stmt.amount); // extrato débitos são negativos

    let bestPayment = null;
    let bestScore = 0;
    let bestDetails: string[] = [];
    let bestDivergences: string[] = [];

    for (const payment of payments) {
      if (usedPaymentIds.has(payment.id)) continue;

      const details: string[] = [];
      const divergences: string[] = [];
      let score = 0;

      // 1. Valor (peso 50)
      const payAmt = payment.amount ?? 0;
      const valueDiff = Math.abs(stmtAmount - payAmt);
      if (valueDiff < 0.01) {
        score += 50;
        details.push('Valor ✓');
      } else if (valueDiff / stmtAmount < 0.02) {
        score += 25;
        details.push('Valor ≈ (diferença < 2%)');
        divergences.push(`Valor: extrato R$${stmtAmount.toFixed(2)} × comprovante R$${payAmt.toFixed(2)}`);
      } else {
        divergences.push(`Valor diverge: extrato R$${stmtAmount.toFixed(2)} × comprovante R$${payAmt.toFixed(2)}`);
      }

      // 2. Data (peso 30)
      if (payment.payment_date && stmt.date) {
        if (payment.payment_date === stmt.date) {
          score += 30;
          details.push('Data ✓');
        } else {
          divergences.push(`Data: extrato ${stmt.date} × comprovante ${payment.payment_date}`);
        }
      }

      // 3. Descrição/Referência (peso 15)
      const sim = similarity(stmt.description, payment.reference);
      if (sim > 0.5) {
        score += Math.round(sim * 15);
        details.push(`Descrição ≈ (${Math.round(sim * 100)}% similar)`);
      } else if (sim > 0) {
        divergences.push(`Descrição pouco similar: "${stmt.description}" × "${payment.reference}"`);
      }

      // 4. NF no extrato (peso 5)
      if (payment.invoice_number) {
        const nfInStmt = stmt.description.includes(payment.invoice_number) ||
          stmt.raw.includes(payment.invoice_number);
        if (nfInStmt) {
          score += 5;
          details.push(`NF ${payment.invoice_number} ✓`);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestPayment = payment;
        bestDetails = details;
        bestDivergences = divergences;
      }
    }

    // Threshold mínimo: pelo menos valor + data devem bater (score >= 80)
    if (bestPayment && bestScore >= 80) {
      usedPaymentIds.add(bestPayment.id);
      usedStatementIndexes.add(si);
      results.push({
        status: bestScore >= 95 ? 'matched' : 'partial',
        statementRow: stmt,
        payment: bestPayment,
        matchScore: bestScore,
        matchDetails: bestDetails,
        divergences: bestDivergences,
      });
    } else {
      // Só valor bate (score >= 50) → parcial
      if (bestPayment && bestScore >= 50) {
        usedPaymentIds.add(bestPayment.id);
        usedStatementIndexes.add(si);
        results.push({
          status: 'partial',
          statementRow: stmt,
          payment: bestPayment,
          matchScore: bestScore,
          matchDetails: bestDetails,
          divergences: bestDivergences,
        });
      } else {
        // Sem correspondência
        results.push({
          status: 'statement_only',
          statementRow: stmt,
          payment: null,
          matchScore: 0,
          matchDetails: [],
          divergences: ['Nenhum comprovante encontrado para este lançamento'],
        });
      }
    }
  }

  // Comprovantes que não aparecem no extrato
  for (const payment of payments) {
    if (!usedPaymentIds.has(payment.id)) {
      results.push({
        status: 'payment_only',
        statementRow: null,
        payment,
        matchScore: 0,
        matchDetails: [],
        divergences: ['Comprovante cadastrado não encontrado no extrato'],
      });
    }
  }

  return results;
}

// ─── Handler POST ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const companyId = String(formData.get('companyId') || '');
  const startDate = String(formData.get('startDate') || '');
  const endDate = String(formData.get('endDate') || '');

  if (!file) return NextResponse.json({ message: 'Arquivo CSV obrigatório.' }, { status: 400 });
  if (!companyId) return NextResponse.json({ message: 'Empresa obrigatória.' }, { status: 400 });

  // Lê o CSV
  const csvText = await file.text();
  const statementRows = parseCSV(csvText);

  if (statementRows.length === 0) {
    return NextResponse.json({ message: 'Nenhum lançamento encontrado no CSV. Verifique o formato.' }, { status: 400 });
  }

  // Busca comprovantes do período e empresa
  let query = supabase
    .from('payments')
    .select('id, reference, amount, payment_date, bank_name, invoice_number')
    .eq('company_id', companyId)
    .eq('created_by', session.user.id);

  if (startDate) query = query.gte('payment_date', startDate);
  if (endDate) query = query.lte('payment_date', endDate);

  const { data: payments, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const results = reconcile(statementRows, payments ?? []);

  // Resumo
  const summary = {
    total: results.length,
    matched: results.filter(r => r.status === 'matched').length,
    partial: results.filter(r => r.status === 'partial').length,
    statementOnly: results.filter(r => r.status === 'statement_only').length,
    paymentOnly: results.filter(r => r.status === 'payment_only').length,
  };

  return NextResponse.json({ results, summary });
}
