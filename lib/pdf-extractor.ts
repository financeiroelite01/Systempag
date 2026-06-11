import pdfParse from 'pdf-parse';

const bankList = [
  'Banco do Brasil',
  'Bradesco',
  'Itaú',
  'Santander',
  'Caixa Econômica Federal',
  'Caixa',
  'Sicredi',
  'Sicoob',
  'Inter',
  'Nubank',
  'Safra',
  'BTG Pactual',
  'C6 Bank',
  'Bancoob'
];

function normalizeText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function parseBrazilianCurrency(raw: string) {
  const normalized = raw.replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.').trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractHighestCurrency(text: string) {
  const matches = [...text.matchAll(/R\$\s?\d{1,3}(?:\.\d{3})*,\d{2}/g)].map((match) =>
    parseBrazilianCurrency(match[0])
  );
  const valid = matches.filter((value): value is number => value !== null);
  if (!valid.length) return null;
  return valid.sort((a, b) => b - a)[0];
}

function extractBank(text: string) {
  for (const bank of bankList) {
    if (new RegExp(bank, 'i').test(text)) return bank;
  }
  const labeled = text.match(/banco(?: do pagamento)?[:\s-]+([A-Za-zÀ-ÿ0-9 ]{3,40})/i);
  return labeled?.[1]?.trim() ?? null;
}

function extractPaymentDate(text: string) {
  const labeledMatch = text.match(/data(?: do pagamento)?[:\s-]+(\d{2}\/\d{2}\/\d{4})/i);
  const genericMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
  const raw = labeledMatch?.[1] ?? genericMatch?.[1];
  if (!raw) return null;
  const [day, month, year] = raw.split('/');
  return `${year}-${month}-${day}`;
}

function extractValue(text: string) {
  const labeledMatch = text.match(
    /valor(?: total| do pagamento)?[:\s-]+(R\$\s?\d{1,3}(?:\.\d{3})*,\d{2})/i
  );
  if (labeledMatch?.[1]) return parseBrazilianCurrency(labeledMatch[1]);
  return extractHighestCurrency(text);
}

/**
 * Extrai NF e referência do nome do arquivo.
 *
 * Padrão esperado:
 *   VALOR - Comp pgt [NF XXX -] DESCRIÇÃO.pdf
 *
 * Exemplos:
 *   "442,00 - Comp pgt NF 282 - Manutencao-conserto de motor"
 *     → invoice: "282", reference: "Manutencao-conserto de motor"
 *
 *   "1144,95 - Comp pgt HOLERITE KELERSON"
 *     → invoice: null, reference: "HOLERITE KELERSON"
 *
 *   "1000,00 - Comp pgt NF 22 - fabricacao passarela e grades"
 *     → invoice: "22", reference: "fabricacao passarela e grades"
 */
function parseFilename(fileName: string): { invoice_number: string | null; reference: string } {
  // Remove extensão
  let name = fileName.replace(/\.pdf$/i, '').trim();

  // 1. Remove o valor no início: ex "442,00 - " | "1144,95 - " | "1.200,00 - "
  //    \d[\d.]* cobre qualquer quantidade de dígitos, com ou sem separador de milhar
  name = name.replace(/^\d[\d.]*,\d{2}\s*-\s*/, '');

  // 2. Remove prefixo fixo "Comp pgt" (case-insensitive)
  name = name.replace(/^comp\s+pgt\s*/i, '');

  // 3. Extrai NF se existir: "NF 282 - " ou "NF22 - "
  let invoice_number: string | null = null;
  const nfMatch = name.match(/^NF\s*(\d+)\s*-\s*/i);
  if (nfMatch) {
    invoice_number = nfMatch[1];
    name = name.slice(nfMatch[0].length);
  }

  // 4. O que sobrou é a descrição — limpa espaços extras
  const reference = name.trim() || 'Pagamento sem referência';

  return { invoice_number, reference };
}

// Mantém as assinaturas originais para compatibilidade com o restante do código
function extractInvoiceFromFilename(fileName: string): string | null {
  return parseFilename(fileName).invoice_number;
}

function extractReferenceFromFilename(fileName: string): string {
  return parseFilename(fileName).reference;
}

export async function extractPaymentDataFromPdf(input: Buffer, fileName: string) {
  const pdf = await pdfParse(input);
  const text = normalizeText(pdf.text || '');

  const bank_name = extractBank(text);
  const payment_date = extractPaymentDate(text);
  const amount = extractValue(text);
  const invoice_number = extractInvoiceFromFilename(fileName);
  const reference = extractReferenceFromFilename(fileName);

  const completionScore = [bank_name, payment_date, amount].filter(Boolean).length;
  const extraction_status = completionScore >= 2 ? 'processed' : 'review';

  return {
    reference,
    invoice_number,
    bank_name,
    payment_date,
    amount,
    file_name: fileName,
    source_text: text.slice(0, 12000),
    extraction_status,
    extracted_data: {
      completionScore,
      rawTextLength: text.length
    }
  };
}