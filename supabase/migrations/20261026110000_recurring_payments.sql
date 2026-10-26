-- Monthly payments (pagos mensuales): recurring services billed every month,
-- e.g. social media management or web maintenance. Each row is an agreement;
-- the monthly receivable ("cobro") is generated from it with one click and
-- never twice for the same month.
--
-- Status:
--   activo     → counts in the monthly recurring total
--   pendiente  → offered / not contracted yet, does NOT count
--   pausado, cancelado → do not count

create type public.recurring_status as enum ('activo', 'pendiente', 'pausado', 'cancelado');

create table public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  concept text not null,
  amount numeric(12, 2) not null,
  status public.recurring_status not null default 'activo',
  start_date date not null default current_date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_concept_len check (char_length(concept) between 1 and 200),
  constraint recurring_amount_positive check (amount > 0)
);

create index recurring_company_status_idx on public.recurring_payments (company_id, status);
create index recurring_client_idx on public.recurring_payments (client_id);

create trigger recurring_updated_at before update on public.recurring_payments
  for each row execute function private.set_updated_at();

create or replace function private.check_recurring_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.client_id is not null and not exists (select 1 from public.clients where id = new.client_id and company_id = new.company_id))
     or (new.project_id is not null and not exists (select 1 from public.projects where id = new.project_id and company_id = new.company_id)) then
    raise exception 'Referencia de otra empresa' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger recurring_check_refs
  before insert or update on public.recurring_payments
  for each row execute function private.check_recurring_refs();

-- Receivables generated from an agreement remember which one and which month.
alter table public.receivables
  add column recurring_id uuid references public.recurring_payments (id) on delete set null,
  add column recurring_period date;

create unique index receivables_one_per_recurring_month
  on public.receivables (recurring_id, recurring_period)
  where recurring_id is not null;

-- Finance data: same access as the rest of finance.
alter table public.recurring_payments enable row level security;

create policy "recurring: finance read" on public.recurring_payments
  for select to authenticated using (private.can_view_finances(company_id));
create policy "recurring: finance create" on public.recurring_payments
  for insert to authenticated
  with check (private.can_view_finances(company_id) and created_by = (select auth.uid()));
create policy "recurring: finance update" on public.recurring_payments
  for update to authenticated
  using (private.can_view_finances(company_id))
  with check (private.can_view_finances(company_id));
create policy "recurring: admin delete" on public.recurring_payments
  for delete to authenticated using (private.is_admin(company_id));

create trigger recurring_activity after insert or update or delete on public.recurring_payments
  for each row execute function private.log_activity('recurring', 'concept', 'true');

-- Generate the receivables of one month for every active agreement that has
-- started, skipping the ones that already exist. Runs as the caller (RLS).
create or replace function public.generate_monthly_receivables(p_company uuid, p_period date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_count integer;
begin
  insert into public.receivables
    (company_id, client_id, project_id, concept, amount, issue_date, due_date, recurring_id, recurring_period, created_by)
  select r.company_id, r.client_id, r.project_id,
         r.concept || ' · ' || to_char(v_period, 'MM/YYYY'),
         r.amount, v_period, v_period + 14, r.id, v_period, auth.uid()
  from public.recurring_payments r
  where r.company_id = p_company
    and r.status = 'activo'
    and r.start_date < (v_period + interval '1 month')::date
  on conflict (recurring_id, recurring_period) where recurring_id is not null do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.generate_monthly_receivables(uuid, date) from public, anon;
grant execute on function public.generate_monthly_receivables(uuid, date) to authenticated;
