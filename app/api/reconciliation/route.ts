import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

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

// ─── Lógica compartilhada: extrai data/valor/descrição de uma linha de colunas ──

// Extrai um valor monetário de uma célula, suportando os formatos:
//   "350,00"        → 350
//   "-350,00"       → -350
//   "R$ 350,00"     → 350
//   "(R$350,00)"    → -350   (parênteses = negativo, comum em extratos bancários)
//   "1.234,56"      → 1234.56
function parseMonetaryValue(rawCol: string): number | null {
  let s = rawCol.trim();
  if (!s) return null;

  // Parênteses indicam valor negativo: "(R$836,82)"
  const isNegative = /^\(.*\)$/.test(s);
  if (isNegative) {
    s = s.slice(1, -1).trim();
  }

  // Remove o símbolo de moeda e espaços extras
  s = s.replace(/R\$/gi, '').trim();

  // Aceita formato brasileiro COM ou SEM ponto de milhar:
  //   "836,82"    → ok (até 3 dígitos antes da vírgula)
  //   "1.100,00"  → ok (com ponto de milhar)
  //   "1100,00"   → ok (sem ponto de milhar — comum em XLS)
  //   "20000,00"  → ok
  // Rejeita: texto puro, datas, etc.
  const isMonetaryFormat = /^-?\d+,\d{2}$/.test(s) ||
                           /^-?\d{1,3}(\.\d{3})+,\d{2}$/.test(s);
  if (!isMonetaryFormat) return null;

  const normalized = s.replace(/\./g, '').replace(',', '.');
  const value = parseFloat(normalized);
  if (isNaN(value)) return null;

  return isNegative ? -Math.abs(value) : value;
}

function extractRowFromColumns(cols: string[], rawLine: string): StatementRow | null {
  let date: string | null = null;
  let amount: number | null = null;
  let description = '';

  for (const rawCol of cols) {
    if (!rawCol) continue;
    const col = rawCol.trim();

    // Data
    const ddmmyyyy = col.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const yyyymmdd = col.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const isDateColumn = Boolean(ddmmyyyy || yyyymmdd);

    if (ddmmyyyy && !date) {
      date = `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
    } else if (yyyymmdd && !date) {
      date = col;
    }

    // Pula a tentativa de valor monetário se a coluna já foi reconhecida como data
    // (evita que "05/06/2026" seja mal interpretado como "5" pelo parseFloat)
    if (isDateColumn) continue;

    // Valor monetário — suporta "R$", parênteses negativos e formato BR
    if (amount === null) {
      const monetary = parseMonetaryValue(col);
      if (monetary !== null && Math.abs(monetary) > 0.01 && Math.abs(monetary) < 10_000_000) {
        amount = monetary;
        continue; // essa coluna é o valor, não a descrição
      }
    }

    // Descrição: coluna de texto mais longa (que não seja o valor já capturado)
    if (col.length > description.length) {
      description = col;
    }
  }

  if (date && amount !== null) {
    return { date, amount, description, raw: rawLine };
  }
  return null;
}

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

    const row = extractRowFromColumns(cols, line);
    if (row) rows.push(row);
  }

  return rows;
}

// ─── Parser de Excel (.xls / .xlsx) ──────────────────────────────────────────

function parseExcel(buffer: Buffer): StatementRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const rows: StatementRow[] = [];

  for (const rawRow of data) {
    let directDate: string | null = null;
    let directAmount: number | null = null;
    let directDescription = '';

    for (const cell of rawRow) {
      // Número puro: captura como valor monetário diretamente (sem converter para string)
      if (typeof cell === 'number') {
        if (directAmount === null && Math.abs(cell) > 0.01 && Math.abs(cell) < 10_000_000) {
          directAmount = cell;
        }
        continue;
      }

      const s = String(cell ?? '').trim();
      if (!s) continue;

      // Data no formato dd/mm/aaaa (string)
      const ddmmyyyy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const yyyymmdd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ddmmyyyy && !directDate) {
        directDate = `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
        continue;
      }
      if (yyyymmdd && !directDate) {
        directDate = s;
        continue;
      }

      // Texto mais longo = descrição
      if (s.length > directDescription.length) {
        directDescription = s;
      }
    }

    // Linha válida: tem data + valor numérico
    if (directDate && directAmount !== null) {
      rows.push({
        date: directDate,
        amount: directAmount,
        description: directDescription,
        raw: (rawRow as unknown[]).map(c => String(c ?? '')).join(' | '),
      });
    }
  }

  return rows;
}

// ─── Detecta o tipo de arquivo e escolhe o parser correto ────────────────────

function parseStatementFile(buffer: Buffer, fileName: string): StatementRow[] {
  const ext = fileName.toLowerCase().split('.').pop();

  if (ext === 'xls' || ext === 'xlsx') {
    return parseExcel(buffer);
  }

  // CSV / TXT — lê como texto
  return parseCSV(buffer.toString('utf-8'));
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
    let bestExactMatch = false; // valor exato + data exata, independente da descrição
    let bestSimilarity = -1;    // usado para desempatar entre múltiplos matches exatos

    for (const payment of payments) {
      if (usedPaymentIds.has(payment.id)) continue;

      const details: string[] = [];
      const divergences: string[] = [];
      let score = 0;
      let valueExact = false;
      let dateExact = false;

      // 1. Valor (peso 50)
      const payAmt = payment.amount ?? 0;
      const valueDiff = Math.abs(stmtAmount - payAmt);
      if (valueDiff < 0.01) {
        score += 50;
        valueExact = true;
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
          dateExact = true;
          details.push('Data ✓');
        } else {
          divergences.push(`Data: extrato ${stmt.date} × comprovante ${payment.payment_date}`);
        }
      }

      // 3. Descrição/Referência (peso 15) — apenas informativo, não impede conciliação
      //    quando valor e data já batem exatamente
      const sim = similarity(stmt.description, payment.reference);
      if (sim > 0.5) {
        score += Math.round(sim * 15);
        details.push(`Descrição ≈ (${Math.round(sim * 100)}% similar)`);
      } else if (sim > 0) {
        details.push(`Descrição divergente (não impede conciliação)`);
      } else {
        details.push(`Descrição não comparável (não impede conciliação)`);
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

      const isExactMatch = valueExact && dateExact;

      // Prioriza match exato de valor+data sobre qualquer score de descrição.
      // Entre múltiplos matches exatos, desempata pela maior similaridade de descrição
      // (mesmo que abaixo do threshold de 0.5 usado para pontuação).
      if (isExactMatch && !bestExactMatch) {
        bestScore = score;
        bestPayment = payment;
        bestDetails = details;
        bestDivergences = divergences;
        bestExactMatch = true;
        bestSimilarity = sim;
      } else if (isExactMatch === bestExactMatch) {
        const isBetter = isExactMatch
          ? sim > bestSimilarity // entre exatos: desempata por similaridade
          : score > bestScore;   // entre não-exatos: desempata por score total
        if (isBetter) {
          bestScore = score;
          bestPayment = payment;
          bestDetails = details;
          bestDivergences = divergences;
          bestSimilarity = sim;
        }
      }
    }

    // Valor + Data exatos = Conciliado automaticamente, independente da descrição
    if (bestPayment && bestExactMatch) {
      usedPaymentIds.add(bestPayment.id);
      usedStatementIndexes.add(si);
      results.push({
        status: 'matched',
        statementRow: stmt,
        payment: bestPayment,
        matchScore: bestScore,
        matchDetails: bestDetails,
        divergences: bestDivergences,
      });
    } else if (bestPayment && bestScore >= 50) {
      // Só valor bate (ou só data) → parcial, precisa revisão manual
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

  if (!file) return NextResponse.json({ message: 'Arquivo do extrato é obrigatório.' }, { status: 400 });
  if (!companyId) return NextResponse.json({ message: 'Empresa obrigatória.' }, { status: 400 });

  // Valida extensão aceita
  const allowedExt = ['csv', 'txt', 'xls', 'xlsx'];
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (!allowedExt.includes(ext)) {
    return NextResponse.json(
      { message: 'Formato não suportado. Envie um arquivo .csv, .txt, .xls ou .xlsx.' },
      { status: 400 }
    );
  }

  // Lê o arquivo (CSV/TXT como texto, XLS/XLSX como binário) e detecta o parser correto
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  let statementRows: StatementRow[];

  try {
    statementRows = parseStatementFile(buffer, file.name);
  } catch (parseError) {
    return NextResponse.json(
      { message: `Erro ao ler o arquivo: ${parseError instanceof Error ? parseError.message : 'formato inválido'}` },
      { status: 400 }
    );
  }

  if (statementRows.length === 0) {
    return NextResponse.json(
      { message: 'Nenhum lançamento encontrado no arquivo. Verifique se há colunas de data e valor.' },
      { status: 400 }
    );
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
