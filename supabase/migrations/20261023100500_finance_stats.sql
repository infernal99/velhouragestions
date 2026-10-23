-- Aggregations for the dashboard and finance statistics. security invoker:
-- RLS on receivables/payments/expenses still applies, so a user without
-- finance access simply gets zeros.

create or replace function public.finance_summary(p_company uuid, p_from date, p_to date)
returns table (
  invoiced numeric,   -- facturación registrada (receivables issued in range)
  collected numeric,  -- cobros reales (payments received in range)
  pending numeric,    -- total still owed today (all open receivables)
  overdue numeric,    -- part of pending already past due
  expenses numeric,   -- gastos (base + tax) in range
  profit numeric      -- collected − expenses
)
language sql
stable
security invoker
set search_path = ''
as $$
  with
    inv as (
      select coalesce(sum(amount), 0) as v from public.receivables
      where company_id = p_company and issue_date between p_from and p_to
    ),
    col as (
      select coalesce(sum(amount), 0) as v from public.payments
      where company_id = p_company and paid_at between p_from and p_to
    ),
    pen as (
      select coalesce(sum(amount - amount_paid), 0) as v,
             coalesce(sum(amount - amount_paid) filter (where due_date < current_date), 0) as od
      from public.receivables
      where company_id = p_company and amount_paid < amount
    ),
    exp as (
      select coalesce(sum(amount + tax_amount), 0) as v from public.expenses
      where company_id = p_company and expense_date between p_from and p_to
    )
  select inv.v, col.v, pen.v, pen.od, exp.v, col.v - exp.v
  from inv, col, pen, exp;
$$;

create or replace function public.finance_monthly(p_company uuid, p_months integer default 12)
returns table (month date, invoiced numeric, collected numeric, expenses numeric, profit numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select (date_trunc('month', current_date) - (n || ' months')::interval)::date as m
    from generate_series(0, greatest(least(p_months, 36), 1) - 1) as n
  )
  select
    months.m,
    coalesce((select sum(amount) from public.receivables r
              where r.company_id = p_company and date_trunc('month', r.issue_date) = months.m), 0),
    coalesce((select sum(amount) from public.payments p
              where p.company_id = p_company and date_trunc('month', p.paid_at) = months.m), 0),
    coalesce((select sum(amount + tax_amount) from public.expenses e
              where e.company_id = p_company and date_trunc('month', e.expense_date) = months.m), 0),
    coalesce((select sum(amount) from public.payments p
              where p.company_id = p_company and date_trunc('month', p.paid_at) = months.m), 0)
    - coalesce((select sum(amount + tax_amount) from public.expenses e
              where e.company_id = p_company and date_trunc('month', e.expense_date) = months.m), 0)
  from months
  order by months.m;
$$;

-- Profitability per project: budget vs invoiced vs collected vs expenses.
create or replace function public.project_profitability(p_company uuid)
returns table (
  project_id uuid, project_name text, budget numeric,
  invoiced numeric, collected numeric, expenses numeric, profit numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id, p.name, coalesce(p.budget, 0),
    coalesce((select sum(amount) from public.receivables r where r.project_id = p.id), 0),
    coalesce((select sum(amount_paid) from public.receivables r where r.project_id = p.id), 0),
    coalesce((select sum(amount + tax_amount) from public.expenses e where e.project_id = p.id), 0),
    coalesce((select sum(amount_paid) from public.receivables r where r.project_id = p.id), 0)
      - coalesce((select sum(amount + tax_amount) from public.expenses e where e.project_id = p.id), 0)
  from public.projects p
  where p.company_id = p_company and p.archived_at is null
  order by p.created_at desc;
$$;

revoke execute on function public.finance_summary(uuid, date, date) from public, anon;
revoke execute on function public.finance_monthly(uuid, integer) from public, anon;
revoke execute on function public.project_profitability(uuid) from public, anon;
grant execute on function public.finance_summary(uuid, date, date) to authenticated;
grant execute on function public.finance_monthly(uuid, integer) to authenticated;
grant execute on function public.project_profitability(uuid) to authenticated;
