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
  const matches = [...text.matchAll(/R\$\s?\d{1,3}(?:\.\d{3})*,\d{2}/g)].map((match) => parseBrazilianCurrency(match[0]));
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
  const labeledMatch = text.match(/valor(?: total| do pagamento)?[:\s-]+(R\$\s?\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (labeledMatch?.[1]) return parseBrazilianCurrency(labeledMatch[1]);
  return extractHighestCurrency(text);
}

function extractReferenceFromFilename(fileName: string) {
  const clean = fileName.replace(/\.pdf$/i, '');
  const withoutNF = clean.replace(/(?:nf|nfs-e|nota fiscal)[\s#:_-]*\d+/i, '').replace(/[_-]+/g, ' ');
  return withoutNF.trim();
}

function extractInvoiceFromFilename(fileName: string) {
  const match = fileName.match(/(?:nf|nfs-e|nota fiscal)[\s#:_-]*(\d+)/i);
  return match?.[1] ?? null;
}

export async function extractPaymentDataFromPdf(input: Buffer, fileName: string) {
  const pdf = await pdfParse(input);
  const text = normalizeText(pdf.text || '');

  const bank_name = extractBank(text);
  const payment_date = extractPaymentDate(text);
  const amount = extractValue(text);
  const invoice_number = extractInvoiceFromFilename(fileName);
  const reference = extractReferenceFromFilename(fileName) || 'Pagamento sem referência';

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
