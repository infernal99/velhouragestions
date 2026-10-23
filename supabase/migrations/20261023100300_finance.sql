-- Finance. Four distinct concepts that must never be mixed up:
--   * quotes      — presupuestos: an offer. NEVER counted as income.
--   * receivables — facturación registrada: an amount the client owes us.
--   * payments    — cobros reales: money actually received against a receivable.
--   * expenses    — gastos.
-- Estimated profit = payments received − expenses (cash basis).
-- A receivable's status is derived from its payments, so a payment can only
-- ever be counted once (it belongs to exactly one receivable and the sum of
-- payments can never exceed the receivable amount).

create type public.quote_status as enum ('borrador', 'enviado', 'aceptado', 'rechazado', 'caducado');
create type public.payment_method as enum ('transferencia', 'tarjeta', 'efectivo', 'bizum', 'paypal', 'stripe', 'domiciliacion', 'otro');

-- ---------------------------------------------------------------------------
-- Quotes
-- ---------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  number text not null,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  status public.quote_status not null default 'borrador',
  issue_date date not null default current_date,
  valid_until date,
  notes text,
  terms text,
  -- maintained by trigger from quote_lines
  subtotal numeric(12, 2) not null default 0,
  discount_total numeric(12, 2) not null default 0,
  tax_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotes_number_unique unique (company_id, number),
  constraint quotes_title_len check (char_length(title) between 1 and 200),
  constraint quotes_dates check (valid_until is null or valid_until >= issue_date)
);

create index quotes_company_status_idx on public.quotes (company_id, status);
create index quotes_client_idx on public.quotes (client_id);

create trigger quotes_updated_at before update on public.quotes
  for each row execute function private.set_updated_at();

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  position integer not null default 0,
  description text not null,
  quantity numeric(12, 3) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  discount_pct numeric(5, 2) not null default 0,
  tax_pct numeric(5, 2) not null default 21,
  -- base after discount, before tax
  line_subtotal numeric(12, 2) generated always as (
    round(quantity * unit_price * (1 - discount_pct / 100), 2)
  ) stored,
  constraint quote_lines_description_len check (char_length(description) between 1 and 1000),
  constraint quote_lines_quantity check (quantity > 0),
  constraint quote_lines_unit_price check (unit_price >= 0),
  constraint quote_lines_discount check (discount_pct between 0 and 100),
  constraint quote_lines_tax check (tax_pct between 0 and 100)
);

create index quote_lines_quote_idx on public.quote_lines (quote_id, position);

create or replace function private.recalc_quote_totals(p_quote uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.quotes q set
    subtotal = coalesce(t.gross, 0),
    discount_total = coalesce(t.gross - t.net, 0),
    tax_total = coalesce(t.tax, 0),
    total = coalesce(t.net + t.tax, 0)
  from (
    select
      round(sum(quantity * unit_price), 2) as gross,
      sum(line_subtotal) as net,
      round(sum(line_subtotal * tax_pct / 100), 2) as tax
    from public.quote_lines where quote_id = p_quote
  ) t
  where q.id = p_quote;
$$;

create or replace function private.quote_lines_totals_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.recalc_quote_totals(old.quote_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.recalc_quote_totals(new.quote_id);
  end if;
  return null;
end;
$$;

create trigger quote_lines_totals
  after insert or update or delete on public.quote_lines
  for each row execute function private.quote_lines_totals_trigger();

-- Assign the next number atomically (row lock on the company) and keep
-- sent/accepted timestamps in step with status.
create or replace function private.prepare_quote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_next integer;
begin
  if tg_op = 'INSERT' and (new.number is null or new.number = '') then
    update public.companies
    set next_quote_number = next_quote_number + 1
    where id = new.company_id
    returning quote_prefix, next_quote_number - 1 into v_prefix, v_next;
    new.number := v_prefix || '-' || to_char(new.issue_date, 'YYYY') || '-' || lpad(v_next::text, 4, '0');
  end if;

  if new.client_id is not null and not exists (
    select 1 from public.clients where id = new.client_id and company_id = new.company_id
  ) then
    raise exception 'El cliente no pertenece a esta empresa' using errcode = '23514';
  end if;

  if new.status = 'enviado' and new.sent_at is null then
    new.sent_at := now();
  end if;
  if new.status = 'aceptado' and new.accepted_at is null then
    new.accepted_at := now();
  elsif new.status <> 'aceptado' then
    new.accepted_at := null;
  end if;
  return new;
end;
$$;

create trigger quotes_prepare
  before insert or update on public.quotes
  for each row execute function private.prepare_quote();

-- Lines of a quote that has been accepted (or converted) are frozen.
create or replace function private.protect_quote_lines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.quote_status;
begin
  select status into v_status from public.quotes where id = coalesce(new.quote_id, old.quote_id);
  if v_status in ('aceptado', 'rechazado', 'caducado') then
    raise exception 'No se pueden modificar las líneas de un presupuesto %', v_status using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger quote_lines_protect
  before insert or update or delete on public.quote_lines
  for each row execute function private.protect_quote_lines();

-- ---------------------------------------------------------------------------
-- Receivables + payments
-- ---------------------------------------------------------------------------
create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  concept text not null,
  amount numeric(12, 2) not null,
  issue_date date not null default current_date,
  due_date date,
  reference text,
  notes text,
  -- maintained by trigger from payments
  amount_paid numeric(12, 2) not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receivables_concept_len check (char_length(concept) between 1 and 300),
  constraint receivables_amount_positive check (amount > 0),
  constraint receivables_paid_range check (amount_paid >= 0 and amount_paid <= amount),
  constraint receivables_dates check (due_date is null or due_date >= issue_date)
);

create index receivables_company_due_idx on public.receivables (company_id, due_date);
create index receivables_project_idx on public.receivables (project_id);
create index receivables_client_idx on public.receivables (client_id);

create trigger receivables_updated_at before update on public.receivables
  for each row execute function private.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  receivable_id uuid not null references public.receivables (id) on delete restrict,
  amount numeric(12, 2) not null,
  paid_at date not null default current_date,
  method public.payment_method not null default 'transferencia',
  reference text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint payments_amount_positive check (amount > 0)
);

create index payments_company_date_idx on public.payments (company_id, paid_at);
create index payments_receivable_idx on public.payments (receivable_id);
-- The same bank/processor reference can't be registered twice.
create unique index payments_reference_unique
  on public.payments (company_id, lower(reference))
  where reference is not null and reference <> '';

-- Derived status, computed on read so "vencido" is always current.
create or replace view public.receivables_with_status
with (security_invoker = true)
as
select
  r.*,
  (r.amount - r.amount_paid) as amount_pending,
  case
    when r.amount_paid >= r.amount then 'pagado'
    when r.due_date is not null and r.due_date < current_date then 'vencido'
    when r.amount_paid > 0 then 'parcial'
    else 'pendiente'
  end as status
from public.receivables r;

create or replace function private.check_receivable_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.client_id is not null and not exists (select 1 from public.clients where id = new.client_id and company_id = new.company_id))
     or (new.project_id is not null and not exists (select 1 from public.projects where id = new.project_id and company_id = new.company_id))
     or (new.quote_id is not null and not exists (select 1 from public.quotes where id = new.quote_id and company_id = new.company_id)) then
    raise exception 'Referencia de otra empresa' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger receivables_check_refs
  before insert or update on public.receivables
  for each row execute function private.check_receivable_refs();

-- Lock the receivable while a payment is written so concurrent payments
-- cannot overshoot the amount, then recompute amount_paid.
create or replace function private.payments_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.receivables%rowtype;
  v_paid numeric(12, 2);
begin
  select * into v_r from public.receivables where id = new.receivable_id for update;
  if not found or v_r.company_id <> new.company_id then
    raise exception 'El cobro no pertenece a esta empresa' using errcode = '23514';
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments
  where receivable_id = new.receivable_id
    and (tg_op = 'INSERT' or id <> new.id);

  if v_paid + new.amount > v_r.amount then
    raise exception 'El pago supera el importe pendiente (pendiente: % €)', (v_r.amount - v_paid)
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger payments_before_write
  before insert or update on public.payments
  for each row execute function private.payments_before();

create or replace function private.payments_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.receivables
    set amount_paid = (select coalesce(sum(amount), 0) from public.payments where receivable_id = old.receivable_id)
    where id = old.receivable_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.receivables
    set amount_paid = (select coalesce(sum(amount), 0) from public.payments where receivable_id = new.receivable_id)
    where id = new.receivable_id;
  end if;
  return null;
end;
$$;

create trigger payments_after_write
  after insert or update or delete on public.payments
  for each row execute function private.payments_after();

-- A receivable's amount cannot drop below what's already been paid.
-- (Enforced by receivables_paid_range.)

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  created_at timestamptz not null default now(),
  constraint expense_categories_name_len check (char_length(name) between 1 and 60),
  constraint expense_categories_color_hex check (color ~ '^#[0-9a-fA-F]{6}$'),
  constraint expense_categories_unique unique (company_id, name)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  concept text not null,
  category_id uuid references public.expense_categories (id) on delete set null,
  amount numeric(12, 2) not null,
  tax_amount numeric(12, 2) not null default 0,
  expense_date date not null default current_date,
  supplier text,
  project_id uuid references public.projects (id) on delete set null,
  receipt_file_id uuid,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_concept_len check (char_length(concept) between 1 and 300),
  constraint expenses_amount_positive check (amount > 0),
  constraint expenses_tax_positive check (tax_amount >= 0)
);

create index expenses_company_date_idx on public.expenses (company_id, expense_date);
create index expenses_project_idx on public.expenses (project_id);
create index expenses_category_idx on public.expenses (category_id);

create trigger expenses_updated_at before update on public.expenses
  for each row execute function private.set_updated_at();

create or replace function private.check_expense_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.category_id is not null and not exists (select 1 from public.expense_categories where id = new.category_id and company_id = new.company_id))
     or (new.project_id is not null and not exists (select 1 from public.projects where id = new.project_id and company_id = new.company_id)) then
    raise exception 'Referencia de otra empresa' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger expenses_check_refs
  before insert or update on public.expenses
  for each row execute function private.check_expense_refs();

-- Default expense categories for new companies.
create or replace function private.seed_expense_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.expense_categories (company_id, name, color) values
    (new.id, 'Software y suscripciones', '#6366f1'),
    (new.id, 'Hosting y dominios', '#0ea5e9'),
    (new.id, 'Publicidad', '#f97316'),
    (new.id, 'Material y equipo', '#84cc16'),
    (new.id, 'Servicios profesionales', '#a855f7'),
    (new.id, 'Impuestos y tasas', '#ef4444'),
    (new.id, 'Otros', '#64748b');
  return new;
end;
$$;

create trigger companies_seed_expense_categories
  after insert on public.companies
  for each row execute function private.seed_expense_categories();

-- ---------------------------------------------------------------------------
-- Convert an accepted quote into a project (idempotent: a quote converts once).
-- Runs as the caller, so RLS still applies to everything it touches.
-- ---------------------------------------------------------------------------
create or replace function public.convert_quote_to_project(p_quote uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_q public.quotes%rowtype;
  v_project uuid;
begin
  select * into v_q from public.quotes where id = p_quote for update;
  if not found then
    raise exception 'Presupuesto no encontrado' using errcode = 'P0002';
  end if;
  if v_q.status <> 'aceptado' then
    raise exception 'Solo se pueden convertir presupuestos aceptados' using errcode = 'P0001';
  end if;
  if v_q.project_id is not null then
    return v_q.project_id;
  end if;

  insert into public.projects (company_id, client_id, name, description, budget, owner_id, created_by, status)
  values (v_q.company_id, v_q.client_id, v_q.title, v_q.notes, v_q.total, auth.uid(), auth.uid(), 'planificado')
  returning id into v_project;

  update public.quotes set project_id = v_project where id = p_quote;
  return v_project;
end;
$$;

revoke execute on function public.convert_quote_to_project(uuid) from public, anon;
grant execute on function public.convert_quote_to_project(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: finance is restricted to admins and members granted finance access.
-- ---------------------------------------------------------------------------
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
alter table public.receivables enable row level security;
alter table public.payments enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

create policy "quotes: finance read" on public.quotes
  for select to authenticated using (private.can_view_finances(company_id));
create policy "quotes: finance write" on public.quotes
  for insert to authenticated
  with check (private.can_view_finances(company_id) and created_by = (select auth.uid()));
create policy "quotes: finance update" on public.quotes
  for update to authenticated
  using (private.can_view_finances(company_id))
  with check (private.can_view_finances(company_id));
create policy "quotes: admin delete" on public.quotes
  for delete to authenticated using (private.is_admin(company_id));

create policy "quote_lines: via quote" on public.quote_lines
  for all to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_id and private.can_view_finances(q.company_id)))
  with check (exists (select 1 from public.quotes q where q.id = quote_id and private.can_view_finances(q.company_id)));

create policy "receivables: finance read" on public.receivables
  for select to authenticated using (private.can_view_finances(company_id));
create policy "receivables: finance create" on public.receivables
  for insert to authenticated
  with check (private.can_view_finances(company_id) and created_by = (select auth.uid()));
create policy "receivables: finance update" on public.receivables
  for update to authenticated
  using (private.can_view_finances(company_id))
  with check (private.can_view_finances(company_id));
create policy "receivables: admin delete" on public.receivables
  for delete to authenticated using (private.is_admin(company_id));

create policy "payments: finance read" on public.payments
  for select to authenticated using (private.can_view_finances(company_id));
create policy "payments: finance create" on public.payments
  for insert to authenticated
  with check (private.can_view_finances(company_id) and created_by = (select auth.uid()));
create policy "payments: admin update" on public.payments
  for update to authenticated
  using (private.is_admin(company_id))
  with check (private.is_admin(company_id));
create policy "payments: admin delete" on public.payments
  for delete to authenticated using (private.is_admin(company_id));

create policy "expense_categories: members read" on public.expense_categories
  for select to authenticated using (private.is_member(company_id));
create policy "expense_categories: admin write" on public.expense_categories
  for all to authenticated
  using (private.is_admin(company_id))
  with check (private.is_admin(company_id));

create policy "expenses: finance read" on public.expenses
  for select to authenticated using (private.can_view_finances(company_id));
create policy "expenses: finance create" on public.expenses
  for insert to authenticated
  with check (private.can_view_finances(company_id) and created_by = (select auth.uid()));
create policy "expenses: finance update" on public.expenses
  for update to authenticated
  using (private.can_view_finances(company_id))
  with check (private.can_view_finances(company_id));
create policy "expenses: admin delete" on public.expenses
  for delete to authenticated using (private.is_admin(company_id));
