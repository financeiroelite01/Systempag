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

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }

  const formData = await request.formData();
  const companyId = String(formData.get('companyId') || '');
  const file = formData.get('file');

  if (!companyId || !(file instanceof File)) {
    return NextResponse.json({ message: 'Empresa e PDF são obrigatórios.' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // --- Bloqueio de arquivo duplicado via hash SHA-256 ---
  const fileHash = createHash('sha256').update(buffer).digest('hex');

  const { data: existing } = await supabase
    .from('payments')
    .select('id, reference, file_name')
    .eq('file_hash', fileHash)
    .eq('created_by', session.user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        message: `Este arquivo já foi enviado anteriormente (referência: "${existing.reference || existing.file_name}"). Envio bloqueado para evitar duplicidade.`
      },
      { status: 409 }
    );
  }
  // ------------------------------------------------------

  const safeName = sanitizeFileName(file.name);
  const filePath = `${session.user.id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('payment-pdfs')
    .upload(filePath, buffer, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (uploadError) {
    return NextResponse.json({ message: uploadError.message }, { status: 400 });
  }

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
      extraction_status: 'error',
      extracted_data: {
        parsingError: error instanceof Error ? error.message : 'Falha ao extrair PDF'
      }
    };
  }

  const { error: insertError } = await supabase.from('payments').insert({
    company_id: companyId,
    ...extracted,
    file_path: filePath,
    file_hash: fileHash,
    created_by: session.user.id
  });

  if (insertError) {
    return NextResponse.json({ message: insertError.message }, { status: 400 });
  }

  return NextResponse.json({
    message:
      extracted.extraction_status === 'processed'
        ? 'PDF enviado e dados extraídos com sucesso.'
        : 'PDF enviado. Revise os campos extraídos antes de usar no fechamento.'
  });
}
