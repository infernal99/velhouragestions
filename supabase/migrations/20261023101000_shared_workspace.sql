-- Shared workspace: every member of a company can see and edit all operational
-- data — projects, clients, tasks, events, comments, files and activity — so
-- the whole team keeps control of everything. What stays restricted:
--   * finances (quotes, receivables, payments, expenses): admins or members
--     granted "acceso a finanzas";
--   * company settings, member management and credential references: admins
--     (and the project owner for credential references);
--   * deleting projects/payments/expenses: admins; clients: client managers.

create or replace function private.can_access_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and private.is_member(p.company_id)
  );
$$;

create or replace function private.can_access_client(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clients c
    where c.id = p_client and private.is_member(c.company_id)
  );
$$;

create or replace function private.can_access_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task and private.is_member(t.company_id)
  );
$$;

create or replace function private.can_access_event(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event and private.is_member(e.company_id)
  );
$$;

drop policy if exists "tasks: create" on public.tasks;
create policy "tasks: create" on public.tasks
  for insert to authenticated
  with check (private.is_member(company_id) and created_by = (select auth.uid()));

drop policy if exists "tasks: update accessible" on public.tasks;
create policy "tasks: update accessible" on public.tasks
  for update to authenticated
  using (private.is_member(company_id))
  with check (private.is_member(company_id));

drop policy if exists "events: create" on public.events;
create policy "events: create" on public.events
  for insert to authenticated
  with check (private.is_member(company_id) and created_by = (select auth.uid()));

drop policy if exists "events: update accessible" on public.events;
create policy "events: update accessible" on public.events
  for update to authenticated
  using (private.is_member(company_id))
  with check (private.is_member(company_id));

-- Activity about tasks and events is visible to everyone in the company.
drop policy if exists "activity: scoped read" on public.activity_log;
create policy "activity: scoped read" on public.activity_log
  for select to authenticated
  using (
    private.is_member(company_id)
    and (not is_finance or private.can_view_finances(company_id))
    and (
      private.is_admin(company_id)
      or actor_id = (select auth.uid())
      or entity_type in ('task', 'event')
      or (project_id is not null and private.can_access_project(project_id))
    )
  );

