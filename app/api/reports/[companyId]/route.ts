import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

export async function GET(
  request: Request,
  { params }: { params: { companyId: string } }
) {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, legal_name, display_name')
    .eq('id', params.companyId)
    .single();

  if (companyError || !company) {
    return NextResponse.json({ message: 'Empresa não encontrada.' }, { status: 404 });
  }

  const { data: payments, error } = await supabase
    .from('payments')
    .select('payment_date, reference, amount, bank_name, invoice_number')
    .eq('company_id', params.companyId)
    .order('payment_date', { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  const rows = (payments || []).map((payment) => ({
    'Data do pagamento': payment.payment_date,
    Referencia: payment.reference,
    Valor: Number(payment.amount || 0),
    'Banco do pagamento': payment.bank_name || '',
    NF: payment.invoice_number || ''
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{
    'Data do pagamento': '',
    Referencia: '',
    Valor: '',
    'Banco do pagamento': '',
    NF: ''
  }]);

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pagamentos');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const filename = `${(company.display_name || company.legal_name).replace(/[^a-zA-Z0-9-_]/g, '-')}-relatorio.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
