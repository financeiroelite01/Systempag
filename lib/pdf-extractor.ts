import pdfParse from 'pdf-parse';

const bankList = [
  'Banco do Brasil',
  'Bradesco',
  'Ita[uú]',
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
  // Prioridade 1: banco do COMPROVANTE (não do emissor do boleto)
  // Procura por "Aplicativo Sicredi", "Bradesco", etc. no texto
  for (const bank of bankList) {
    // Testa se o banco aparece em contexto de comprovante/aplicativo
    const appMatch = text.match(new RegExp('(?:aplicativo|comprovante|transação)\\s+' + bank, 'i'));
    if (appMatch) return bank;
  }

  // Prioridade 2: "Instituição do pagador:" (origem do dinheiro)
  let match = text.match(/institui[cç][aã]o\s+do\s+pagador\s*:\s*([A-Za-zÀ-ÿ0-9\s.]+?)(?=\s+(?:CNPJ|CPF|Nome|Agência|Cooperativa|Conta|Institui))/i);
  if (match) {
    return match[1].trim().replace(/\s+/g, ' ');
  }

  // Prioridade 3: "Banco Origem:" ou "Instituição Origem:"
  match = text.match(/(?:banco|institui[cç][aã]o)\s+(?:de\s+)?origem\s*:\s*([A-Za-zÀ-ÿ0-9\s.]+?)(?=\s+(?:CNPJ|CPF|Nome|Agência|Cooperativa|Conta|Institui))/i);
  if (match) {
    return match[1].trim().replace(/\s+/g, ' ');
  }

  // Prioridade 4: qualquer banco da lista (fallback)
  for (const bank of bankList) {
    const bankMatch = text.match(new RegExp(bank + '[A-Za-zÀ-ÿ0-9\\s]*', 'i'));
    if (bankMatch) {
      const cleaned = bankMatch[0]
        .replace(/Institui[cç][aã]o.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned || bankMatch[0].trim();
    }
  }

  // Prioridade 5: Formato normal: "Banco: Nome do Banco"
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
  const num = '(\\d{1,3}(?:\\.\\d{3})*,\\d{2})';

  // Alguns PDFs (ex: comprovantes Sicredi) extraem o texto em ordem invertida:
  // "350,00Valor Pago (R$):" em vez de "Valor Pago (R$): 350,00"
  // Por isso checamos os dois formatos para cada prioridade.

  // Prioridade 1: "Valor Pago"
  let match = text.match(new RegExp(num + '\\s*valor\\s*pago\\s*(?:\\(r\\$\\))?\\s*:', 'i'));
  if (match) return parseBrazilianCurrency(match[1]);
  match = text.match(new RegExp('valor\\s*pago\\s*(?:\\(r\\$\\))?\\s*[:\\s-]+\\s*(?:r\\$\\s*)?' + num, 'i'));
  if (match) return parseBrazilianCurrency(match[1]);

  // Prioridade 2: "Valor Total" ou "Valor do Pagamento"
  match = text.match(new RegExp(num + '\\s*valor\\s*(?:total|do pagamento)\\s*(?:\\(r\\$\\))?\\s*:', 'i'));
  if (match) return parseBrazilianCurrency(match[1]);
  match = text.match(new RegExp('valor\\s*(?:total|do pagamento)\\s*(?:\\(r\\$\\))?\\s*[:\\s-]+\\s*(?:r\\$\\s*)?' + num, 'i'));
  if (match) return parseBrazilianCurrency(match[1]);

  // Prioridade 3: "Valor" genérico
  match = text.match(new RegExp(num + '\\s*valor\\s*(?:\\(r\\$\\))?\\s*:', 'i'));
  if (match) return parseBrazilianCurrency(match[1]);
  match = text.match(new RegExp('valor\\s*(?:\\(r\\$\\))?\\s*[:\\s-]+\\s*(?:r\\$\\s*)?' + num, 'i'));
  if (match) return parseBrazilianCurrency(match[1]);

  // Fallback: maior valor monetário com R$ encontrado no texto
  return extractHighestCurrency(text);
}

/**
 * Extrai NF e referência do nome do arquivo.
 *
 * Padrões suportados:
 *
 *   COM NF:
 *   "350,00 - Comp pgt NF 19531 - Coleta de residuos - NORTE AMBIENTAL.pdf"
 *     → invoice: "19531", reference: "Coleta de residuos - NORTE AMBIENTAL"
 *
 *   SEM NF (novo padrão, com traço após "Comp pgt"):
 *   "82,47 - Comp pgt - Seguro de Vida USINA.pdf"
 *     → invoice: null, reference: "Seguro de Vida USINA"
 *
 *   SEM NF (padrão antigo, sem traço):
 *   "1144,95 - Comp pgt HOLERITE KELERSON.pdf"
 *     → invoice: null, reference: "HOLERITE KELERSON"
 */
function parseFilename(fileName: string): { invoice_number: string | null; reference: string } {
  // 1. Remove extensão
  let name = fileName.replace(/\.pdf$/i, '').trim();

  // 2. Remove o valor no início: "350,00 - " | "1.200,00 - "
  name = name.replace(/^\d[\d.]*,\d{2}\s*-\s*/, '');

  // 3. Remove prefixo "Comp pgt" (case-insensitive)
  name = name.replace(/^comp\s+pgt\s*/i, '');

  // 4. Remove traço separador opcional que fica após "Comp pgt" quando não há NF:
  //    "- Seguro de Vida" → "Seguro de Vida"
  //    Só remove se NÃO vier "NF" logo a seguir (para não afetar o padrão com NF)
  if (!name.match(/^NF\s*\d+/i)) {
    name = name.replace(/^-\s*/, '');
  }

  // 5. Extrai NF se existir: "NF 282 - " ou "NF282 - "
  let invoice_number: string | null = null;
  const nfMatch = name.match(/^NF\s*(\d+)\s*-\s*/i);
  if (nfMatch) {
    invoice_number = nfMatch[1];
    name = name.slice(nfMatch[0].length);
  }

  // 6. O que sobrou é a descrição
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
