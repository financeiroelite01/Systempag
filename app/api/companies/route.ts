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

  const { error } = await supabase.from('companies').insert({
    owner_user_id: session.user.id,
    legal_name: String(body.legalName || '').trim(),
    display_name: String(body.displayName || '').trim() || null,
    tax_id: String(body.taxId || '').trim() || null
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ message: 'Empresa cadastrada com sucesso.' });
}
