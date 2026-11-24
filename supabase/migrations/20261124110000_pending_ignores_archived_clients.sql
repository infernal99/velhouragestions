-- Archived (deactivated) clients no longer count towards "pendiente / vencido".
-- Their history (invoiced, collected) is kept untouched.
create or replace function public.finance_summary(p_company uuid, p_from date, p_to date)
returns table (
  invoiced numeric,
  collected numeric,
  pending numeric,
  overdue numeric,
  expenses numeric,
  profit numeric
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
      select coalesce(sum(r.amount - r.amount_paid), 0) as v,
             coalesce(sum(r.amount - r.amount_paid) filter (where r.due_date < current_date), 0) as od
      from public.receivables r
      left join public.clients c on c.id = r.client_id
      where r.company_id = p_company and r.amount_paid < r.amount and c.archived_at is null
    ),
    exp as (
      select coalesce(sum(amount + tax_amount), 0) as v from public.expenses
      where company_id = p_company and expense_date between p_from and p_to
    )
  select inv.v, col.v, pen.v, pen.od, exp.v, col.v - exp.v
  from inv, col, pen, exp;
$$;
