import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractPaymentDataFromPdf } from '@/lib/pdf-extractor';
import { createHash } from 'crypto';

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}

type FileResult = {
  fileName: string;
  status: 'success' | 'duplicate' | 'error';
  message: string;
  reference?: string;
  amount?: number | null;
  bank_name?: string | null;
  payment_date?: string | null;
};

async function processFile(
  file: File,
  companyId: string,
  userId: string,
  supabase: ReturnType<typeof createClient>
): Promise<FileResult> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Bloqueia duplicata por hash
  const fileHash = createHash('sha256').update(buffer).digest('hex');
  const { data: existing } = await supabase
    .from('payments')
    .select('id, reference, file_name')
    .eq('file_hash', fileHash)
    .eq('created_by', userId)
    .maybeSingle();

  if (existing) {
    return {
      fileName: file.name,
      status: 'duplicate',
      message: `Duplicado — já enviado como "${existing.reference || existing.file_name}"`
    };
  }

  // Upload para storage
  const safeName = sanitizeFileName(file.name);
  const filePath = `${userId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('payment-pdfs')
    .upload(filePath, buffer, { contentType: 'application/pdf', upsert: false });

  if (uploadError) {
    return { fileName: file.name, status: 'error', message: uploadError.message };
  }

  // Extração
  let extracted;
  try {
    extracted = await extractPaymentDataFromPdf(buffer, file.name);
  } catch (error) {
    extracted = {
      reference: file.name.replace(/\.pdf$/i, ''),
      invoice_number: null,
      bank_name: null,
      payment_date: null,
      amount: null,
      file_name: file.name,
      source_text: '',
      extraction_status: 'error' as const,
      extracted_data: {
        parsingError: error instanceof Error ? error.message : 'Falha ao extrair PDF'
      }
    };
  }

  // Inserção no banco
  const { error: insertError } = await supabase.from('payments').insert({
    company_id: companyId,
    ...extracted,
    file_path: filePath,
    file_hash: fileHash,
    created_by: userId
  });

  if (insertError) {
    return { fileName: file.name, status: 'error', message: insertError.message };
  }

  return {
    fileName: file.name,
    status: 'success',
    message: extracted.extraction_status === 'processed'
      ? 'Processado com sucesso'
      : 'Enviado — revisar campos extraídos',
    reference: extracted.reference,
    amount: extracted.amount,
    bank_name: extracted.bank_name,
    payment_date: extracted.payment_date
  };
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }

  const formData = await request.formData();
  const companyId = String(formData.get('companyId') || '');
  const files = formData.getAll('files').filter((f): f is File => f instanceof File);

  if (!companyId) {
    return NextResponse.json({ message: 'Empresa é obrigatória.' }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ message: 'Nenhum arquivo enviado.' }, { status: 400 });
  }
  if (files.length > 10) {
    return NextResponse.json({ message: 'Máximo de 10 arquivos por lote.' }, { status: 400 });
  }

  // Processa todos em paralelo
  const results = await Promise.all(
    files.map((file) => processFile(file, companyId, session.user.id, supabase))
  );

  const success = results.filter((r) => r.status === 'success').length;
  const duplicates = results.filter((r) => r.status === 'duplicate').length;
  const errors = results.filter((r) => r.status === 'error').length;

  return NextResponse.json({ results, summary: { total: files.length, success, duplicates, errors } });
}
