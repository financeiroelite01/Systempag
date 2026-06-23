import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ─── PATCH — Atualizar empresa ────────────────────────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });

  const body = await request.json();

  const { error } = await supabase
    .from('companies')
    .update({
      legal_name:   String(body.legalName   || '').trim(),
      display_name: String(body.displayName || '').trim() || null,
      tax_id:       String(body.taxId       || '').trim() || null,
    })
    .eq('id', params.id)
    .eq('owner_user_id', session.user.id);

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ message: 'Empresa atualizada com sucesso.' });
}

// ─── DELETE — Excluir empresa ─────────────────────────────────────────────────
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });

  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', params.id)
    .eq('owner_user_id', session.user.id);

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ message: 'Empresa excluída.' });
}
