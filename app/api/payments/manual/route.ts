import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }

  const body = await request.json();

  const payload = {
    company_id: String(body.companyId),
    reference: String(body.reference || '').trim(),
    invoice_number: String(body.invoiceNumber || '').trim() || null,
    bank_name: String(body.bankName || '').trim() || null,
    payment_date: String(body.paymentDate),
    amount: Number(body.amount),
    file_name: `manual-${Date.now()}.pdf`,
    extraction_status: 'processed',
    created_by: session.user.id,
    extracted_data: { source: 'manual' }
  };

  const { error } = await supabase.from('payments').insert(payload);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ message: 'Pagamento manual cadastrado.' });
}
