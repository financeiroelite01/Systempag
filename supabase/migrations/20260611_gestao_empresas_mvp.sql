-- Execute este SQL no projeto GestaoEmpresas caso o MCP esteja em modo read-only.
create extension if not exists pgcrypto;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  legal_name text not null,
  display_name text,
  tax_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'manager', 'viewer')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  reference text not null,
  invoice_number text,
  bank_name text,
  payment_date date,
  amount numeric(14,2),
  file_name text not null,
  file_path text,
  source_text text,
  extraction_status text not null default 'review' check (extraction_status in ('pending', 'processed', 'review', 'error')),
  extracted_data jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_owner_user_id_idx on public.companies(owner_user_id);
create index if not exists company_members_company_id_idx on public.company_members(company_id);
create index if not exists company_members_user_id_idx on public.company_members(user_id);
create index if not exists payments_company_id_idx on public.payments(company_id);
create index if not exists payments_payment_date_idx on public.payments(payment_date desc);
create index if not exists payments_extraction_status_idx on public.payments(extraction_status);
create index if not exists payments_created_by_idx on public.payments(created_by);
create index if not exists payments_invoice_number_idx on public.payments(invoice_number);

create or replace function public.handle_company_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.company_members (company_id, user_id, role)
  values (new.id, new.owner_user_id, 'admin')
  on conflict (company_id, user_id) do nothing;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
create trigger trg_companies_updated_at before update on public.companies for each row execute function public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
create trigger trg_payments_updated_at before update on public.payments for each row execute function public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_company_owner_membership ON public.companies;
create trigger trg_company_owner_membership after insert on public.companies for each row execute function public.handle_company_owner_membership();

create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.companies c where c.id = p_company_id and c.owner_user_id = auth.uid()
    union all
    select 1 from public.company_members cm where cm.company_id = p_company_id and cm.user_id = auth.uid()
  );
$$;

create or replace function public.is_company_admin(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.companies c where c.id = p_company_id and c.owner_user_id = auth.uid()
    union all
    select 1 from public.company_members cm where cm.company_id = p_company_id and cm.user_id = auth.uid() and cm.role in ('admin', 'manager')
  );
$$;

create or replace view public.vw_payment_dashboard as
select
  p.id,
  p.company_id,
  c.legal_name,
  coalesce(c.display_name, c.legal_name) as company_name,
  p.payment_date,
  p.reference,
  p.amount,
  p.bank_name,
  p.invoice_number,
  p.file_name,
  p.extraction_status,
  p.created_at
from public.payments p
join public.companies c on c.id = p.company_id;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.payments enable row level security;

drop policy if exists "companies_select_member" on public.companies;
create policy "companies_select_member" on public.companies for select using (public.is_company_member(id));
drop policy if exists "companies_insert_owner" on public.companies;
create policy "companies_insert_owner" on public.companies for insert to authenticated with check (owner_user_id = auth.uid());
drop policy if exists "companies_update_admin" on public.companies;
create policy "companies_update_admin" on public.companies for update to authenticated using (public.is_company_admin(id)) with check (public.is_company_admin(id));
drop policy if exists "companies_delete_admin" on public.companies;
create policy "companies_delete_admin" on public.companies for delete to authenticated using (public.is_company_admin(id));

drop policy if exists "company_members_select_member" on public.company_members;
create policy "company_members_select_member" on public.company_members for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "company_members_insert_admin" on public.company_members;
create policy "company_members_insert_admin" on public.company_members for insert to authenticated with check (public.is_company_admin(company_id));
drop policy if exists "company_members_update_admin" on public.company_members;
create policy "company_members_update_admin" on public.company_members for update to authenticated using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
drop policy if exists "company_members_delete_admin" on public.company_members;
create policy "company_members_delete_admin" on public.company_members for delete to authenticated using (public.is_company_admin(company_id));

drop policy if exists "payments_select_member" on public.payments;
create policy "payments_select_member" on public.payments for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "payments_insert_member" on public.payments;
create policy "payments_insert_member" on public.payments for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "payments_update_member" on public.payments;
create policy "payments_update_member" on public.payments for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "payments_delete_admin" on public.payments;
create policy "payments_delete_admin" on public.payments for delete to authenticated using (public.is_company_admin(company_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-pdfs', 'payment-pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "payment_pdfs_select_own" on storage.objects;
create policy "payment_pdfs_select_own" on storage.objects for select to authenticated using (bucket_id = 'payment-pdfs' and owner = auth.uid());
drop policy if exists "payment_pdfs_insert_own" on storage.objects;
create policy "payment_pdfs_insert_own" on storage.objects for insert to authenticated with check (bucket_id = 'payment-pdfs' and owner = auth.uid());
drop policy if exists "payment_pdfs_update_own" on storage.objects;
create policy "payment_pdfs_update_own" on storage.objects for update to authenticated using (bucket_id = 'payment-pdfs' and owner = auth.uid()) with check (bucket_id = 'payment-pdfs' and owner = auth.uid());
drop policy if exists "payment_pdfs_delete_own" on storage.objects;
create policy "payment_pdfs_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'payment-pdfs' and owner = auth.uid());
