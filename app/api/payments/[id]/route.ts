import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH /api/payments/[id]
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }

  const body = await request.json();

  const { error } = await supabase
    .from('payments')
    .update({
      reference: String(body.reference || '').trim(),
      invoice_number: String(body.invoiceNumber || '').trim() || null,
      bank_name: String(body.bankName || '').trim() || null,
      payment_date: String(body.paymentDate || '').trim() || null,
      amount: body.amount !== '' && body.amount !== null ? Number(body.amount) : null
    })
    .eq('id', params.id)
    .eq('created_by', session.user.id); // garante que só o dono edita

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ message: 'Pagamento atualizado com sucesso.' });
}

// DELETE /api/payments/[id]
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }

  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', params.id)
    .eq('created_by', session.user.id); // garante que só o dono exclui

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ message: 'Pagamento excluído com sucesso.' });
}
