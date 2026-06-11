import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/dashboard-shell';

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const [{ data: companies }, { data: payments }] = await Promise.all([
    supabase.from('companies').select('id, legal_name, display_name').order('created_at', { ascending: false }),
    supabase
      .from('vw_payment_dashboard')
      .select('id, company_id, company_name, payment_date, reference, amount, bank_name, invoice_number, extraction_status')
      .order('created_at', { ascending: false })
      .limit(200)
  ]);

  return (
    <DashboardShell
      userEmail={session.user.email ?? 'sem-email'}
      companies={companies ?? []}
      payments={payments ?? []}
    />
  );
}
