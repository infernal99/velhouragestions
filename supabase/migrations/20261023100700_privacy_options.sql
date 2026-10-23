-- Privacy option from Ajustes: "members see all clients". Off by default:
-- members only see clients they own, created, or work on through a project.

create or replace function private.can_access_client(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clients c
    join public.memberships m
      on m.company_id = c.company_id and m.user_id = (select auth.uid())
    join public.companies co on co.id = c.company_id
    where c.id = p_client
      and (
        m.role = 'admin'
        or m.can_manage_clients
        or coalesce((co.preferences -> 'privacy' ->> 'members_see_all_clients')::boolean, false)
        or c.owner_id = (select auth.uid())
        or c.created_by = (select auth.uid())
        or exists (
          select 1 from public.projects p
          where p.client_id = c.id and private.can_access_project(p.id)
        )
      )
  );
$$;

-- The daily reminders respect the company's notification switches too.
create or replace function public.generate_due_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select t.id, t.company_id, t.assignee_id, t.title, t.due_date
    from public.tasks t
    join public.companies co on co.id = t.company_id
    where t.status <> 'completada'
      and t.assignee_id is not null
      and t.due_date between current_date and current_date + 1
      and coalesce((co.preferences -> 'notifications' ->> 'due_soon')::boolean, true)
  loop
    insert into public.notifications (company_id, user_id, kind, title, body, link, dedupe_key)
    values (r.company_id, r.assignee_id, 'due_soon',
      case when r.due_date = current_date then 'Tarea que vence hoy' else 'Tarea que vence mañana' end,
      r.title, '/tareas?tarea=' || r.id, 'task_due:' || r.id || ':' || r.due_date)
    on conflict do nothing;
    v_count := v_count + 1;
  end loop;

  for r in
    select rc.id, rc.company_id, rc.concept, rc.due_date, m.user_id
    from public.receivables rc
    join public.companies co on co.id = rc.company_id
    join public.memberships m
      on m.company_id = rc.company_id and (m.role = 'admin' or m.can_view_finances)
    where rc.amount_paid < rc.amount
      and rc.due_date between current_date and current_date + 3
      and coalesce((co.preferences -> 'notifications' ->> 'payment_due')::boolean, true)
  loop
    insert into public.notifications (company_id, user_id, kind, title, body, link, dedupe_key)
    values (r.company_id, r.user_id, 'payment_due', 'Cobro próximo a vencer',
      r.concept || ' vence el ' || to_char(r.due_date, 'DD/MM/YYYY'), '/finanzas/cobros',
      'receivable_due:' || r.id || ':' || r.due_date)
    on conflict do nothing;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.generate_due_reminders() from public, anon, authenticated;
