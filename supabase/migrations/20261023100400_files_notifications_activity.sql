-- Documents (Supabase Storage), in-app notifications, activity log, global
-- search and the due-date reminders job.

create type public.file_category as enum (
  'briefing', 'diseno', 'contrato', 'presupuesto', 'tecnico', 'imagen', 'recurso_cliente', 'justificante', 'otro'
);

-- ---------------------------------------------------------------------------
-- Files
-- ---------------------------------------------------------------------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  category public.file_category not null default 'otro',
  name text not null,
  -- "<company_id>/<uuid>-<sanitised name>" inside the company-files bucket
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0,
  -- finance-only documents (receipts) are hidden from regular members
  is_finance boolean not null default false,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint files_name_len check (char_length(name) between 1 and 255),
  constraint files_size check (size_bytes >= 0 and size_bytes <= 52428800),
  constraint files_path_company check (split_part(storage_path, '/', 1) = company_id::text)
);

create index files_company_idx on public.files (company_id, created_at desc);
create index files_project_idx on public.files (project_id);
create index files_client_idx on public.files (client_id);
create index files_name_trgm_idx on public.files using gin (lower(name) extensions.gin_trgm_ops);

alter table public.expenses
  add constraint expenses_receipt_fk foreign key (receipt_file_id) references public.files (id) on delete set null;

create or replace function private.can_access_file(p_company uuid, p_project uuid, p_client uuid, p_is_finance boolean, p_uploaded_by uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_member(p_company)
    and (not p_is_finance or private.can_view_finances(p_company))
    and (
      private.is_admin(p_company)
      or p_uploaded_by = (select auth.uid())
      or (p_project is not null and private.can_access_project(p_project))
      or (p_project is null and p_client is not null and private.can_access_client(p_client))
      or (p_project is null and p_client is null)
    );
$$;

grant execute on function private.can_access_file(uuid, uuid, uuid, boolean, uuid) to authenticated;

create or replace function private.check_file_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.project_id is not null and not exists (select 1 from public.projects where id = new.project_id and company_id = new.company_id))
     or (new.client_id is not null and not exists (select 1 from public.clients where id = new.client_id and company_id = new.company_id))
     or (new.task_id is not null and not exists (select 1 from public.tasks where id = new.task_id and company_id = new.company_id)) then
    raise exception 'Referencia de otra empresa' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger files_check_refs
  before insert or update on public.files
  for each row execute function private.check_file_refs();

alter table public.files enable row level security;

create policy "files: read accessible" on public.files
  for select to authenticated
  using (private.can_access_file(company_id, project_id, client_id, is_finance, uploaded_by));
create policy "files: upload" on public.files
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and private.can_access_file(company_id, project_id, client_id, is_finance, uploaded_by)
  );
create policy "files: uploader or admin update" on public.files
  for update to authenticated
  using (uploaded_by = (select auth.uid()) or private.is_admin(company_id))
  with check (private.can_access_file(company_id, project_id, client_id, is_finance, uploaded_by));
create policy "files: uploader or admin delete" on public.files
  for delete to authenticated
  using (uploaded_by = (select auth.uid()) or private.is_admin(company_id));

-- ---------------------------------------------------------------------------
-- Storage buckets
--   company-files: private, path "<company_id>/..."; object access mirrors
--                  the files table (a download needs a readable files row).
--   public-assets: public read, for avatars ("avatars/<user_id>/...") and
--                  company logos ("logos/<company_id>/...").
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('company-files', 'company-files', false, 52428800)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-assets', 'public-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "company-files: read via files row" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'company-files'
    and exists (select 1 from public.files f where f.storage_path = name)
  );

create policy "company-files: members upload to own company" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-files'
    and private.is_member(((storage.foldername(name))[1])::uuid)
  );

create policy "company-files: delete via files row" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'company-files'
    and (
      exists (
        select 1 from public.files f
        where f.storage_path = name
          and (f.uploaded_by = (select auth.uid()) or private.is_admin(f.company_id))
      )
      -- orphaned upload (files row never created) can be cleaned by its owner
      or (owner_id = (select auth.uid())::text and not exists (select 1 from public.files f where f.storage_path = name))
    )
  );

create policy "public-assets: own avatar write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "public-assets: own avatar update/delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "public-assets: admin logo write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = 'logos'
    and private.is_admin(((storage.foldername(name))[2])::uuid)
  );

create policy "public-assets: admin logo delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = 'logos'
    and private.is_admin(((storage.foldername(name))[2])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  title text not null,
  body text,
  link text,
  -- prevents the daily reminder job from notifying the same thing twice
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_link_internal check (link is null or link like '/%')
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

alter table public.notifications enable row level security;

create policy "notifications: own read" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: own mark read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "notifications: own delete" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

-- Inserts only happen from triggers below (security definer).
create or replace function private.notify(
  p_company uuid, p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_dedupe text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_prefs jsonb;
begin
  if p_user is null or p_user = v_actor then
    return;
  end if;
  -- the recipient must still be a member of the company
  if not exists (select 1 from public.memberships where company_id = p_company and user_id = p_user) then
    return;
  end if;
  -- company-level switch per notification kind (default on)
  select preferences -> 'notifications' into v_prefs from public.companies where id = p_company;
  if v_prefs is not null and (v_prefs ->> p_kind) = 'false' then
    return;
  end if;

  insert into public.notifications (company_id, user_id, actor_id, kind, title, body, link, dedupe_key)
  values (p_company, p_user, v_actor, p_kind, p_title, p_body, p_link, p_dedupe)
  on conflict do nothing;
end;
$$;

create or replace function private.notify_task_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform private.notify(
      new.company_id, new.assignee_id,
      case when tg_op = 'INSERT' then 'task_assigned' else 'assignee_changed' end,
      'Te han asignado una tarea', new.title, '/tareas?tarea=' || new.id
    );
  end if;
  return null;
end;
$$;

create trigger tasks_notify
  after insert or update of assignee_id on public.tasks
  for each row execute function private.notify_task_changes();

create or replace function private.notify_project_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if new.owner_id is not null and new.owner_id is distinct from old.owner_id then
    perform private.notify(new.company_id, new.owner_id, 'assignee_changed',
      'Ahora eres responsable de un proyecto', new.name, '/proyectos/' || new.id);
  end if;

  if new.status is distinct from old.status or new.due_date is distinct from old.due_date then
    for v_user in
      select pm.user_id from public.project_members pm where pm.project_id = new.id
      union
      select new.owner_id where new.owner_id is not null
    loop
      perform private.notify(new.company_id, v_user, 'project_updated',
        'Proyecto actualizado', new.name || ' ha cambiado de estado o fecha', '/proyectos/' || new.id);
    end loop;
  end if;
  return null;
end;
$$;

create trigger projects_notify
  after update of owner_id, status, due_date on public.projects
  for each row execute function private.notify_project_changes();

create or replace function private.notify_new_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_title text;
  v_link text;
begin
  if new.task_id is not null then
    select title, '/tareas?tarea=' || id into v_title, v_link from public.tasks where id = new.task_id;
    for v_user in
      select assignee_id from public.tasks where id = new.task_id and assignee_id is not null
      union select created_by from public.tasks where id = new.task_id and created_by is not null
      union select user_id from public.task_collaborators where task_id = new.task_id
      union select author_id from public.comments where task_id = new.task_id and author_id is not null
    loop
      perform private.notify(new.company_id, v_user, 'comment', 'Nuevo comentario en ' || v_title, left(new.body, 140), v_link);
    end loop;
  elsif new.project_id is not null then
    select name, '/proyectos/' || id into v_title, v_link from public.projects where id = new.project_id;
    for v_user in
      select owner_id from public.projects where id = new.project_id and owner_id is not null
      union select user_id from public.project_members where project_id = new.project_id
      union select author_id from public.comments where project_id = new.project_id and author_id is not null
    loop
      perform private.notify(new.company_id, v_user, 'comment', 'Nuevo comentario en ' || v_title, left(new.body, 140), v_link);
    end loop;
  elsif new.client_id is not null then
    select name, '/clientes/' || id into v_title, v_link from public.clients where id = new.client_id;
    for v_user in
      select owner_id from public.clients where id = new.client_id and owner_id is not null
      union select author_id from public.comments where client_id = new.client_id and author_id is not null
    loop
      perform private.notify(new.company_id, v_user, 'comment', 'Nuevo comentario en ' || v_title, left(new.body, 140), v_link);
    end loop;
  end if;
  return null;
end;
$$;

create trigger comments_notify
  after insert on public.comments
  for each row execute function private.notify_new_comment();

-- Daily job: tasks due tomorrow/today and receivables due within 3 days.
-- Safe to run repeatedly thanks to dedupe keys.
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
    where t.status <> 'completada'
      and t.assignee_id is not null
      and t.due_date between current_date and current_date + 1
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
    join public.memberships m
      on m.company_id = rc.company_id and (m.role = 'admin' or m.can_view_finances)
    where rc.amount_paid < rc.amount
      and rc.due_date between current_date and current_date + 3
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

-- Schedule it with pg_cron when available (enable the extension in the
-- Supabase dashboard; otherwise run `select public.generate_due_reminders()`).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('velhoura-due-reminders', '0 7 * * *', 'select public.generate_due_reminders()');
  end if;
exception when others then
  raise notice 'pg_cron no disponible: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- Activity log (written only by triggers, so it can't be forged)
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  entity_label text,
  project_id uuid references public.projects (id) on delete set null,
  is_finance boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_company_idx on public.activity_log (company_id, created_at desc);
create index activity_project_idx on public.activity_log (project_id, created_at desc);
create index activity_entity_idx on public.activity_log (entity_type, entity_id);

alter table public.activity_log enable row level security;

create policy "activity: scoped read" on public.activity_log
  for select to authenticated
  using (
    private.is_member(company_id)
    and (not is_finance or private.can_view_finances(company_id))
    and (
      private.is_admin(company_id)
      or actor_id = (select auth.uid())
      or (project_id is not null and private.can_access_project(project_id))
      or (project_id is null and entity_type in ('task', 'event'))
    )
  );

create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  v_entity text := tg_argv[0];
  v_label_col text := tg_argv[1];
  v_finance boolean := coalesce(tg_argv[2], 'false')::boolean;
  v_action text;
  v_project uuid;
  v_meta jsonb := '{}'::jsonb;
begin
  v_action := case tg_op when 'INSERT' then 'created' when 'DELETE' then 'deleted' else 'updated' end;

  if tg_op = 'UPDATE' then
    if v_row ? 'status' and v_row ->> 'status' is distinct from v_old ->> 'status' then
      v_action := 'status_changed';
      v_meta := jsonb_build_object('from', v_old ->> 'status', 'to', v_row ->> 'status');
    elsif v_row ? 'archived_at' and v_row ->> 'archived_at' is distinct from v_old ->> 'archived_at' then
      v_action := case when v_row ->> 'archived_at' is null then 'restored' else 'archived' end;
    elsif (v_row - 'updated_at' - 'progress' - 'amount_paid' - 'subtotal' - 'discount_total' - 'tax_total' - 'total')
          = (v_old - 'updated_at' - 'progress' - 'amount_paid' - 'subtotal' - 'discount_total' - 'tax_total' - 'total') then
      -- only derived columns changed (trigger side effects): not user activity
      return null;
    end if;
  end if;

  v_project := case
    when v_entity = 'project' then (v_row ->> 'id')::uuid
    when v_row ? 'project_id' then (v_row ->> 'project_id')::uuid
    else null
  end;

  -- the project row itself is gone on delete; don't point the FK at it
  if tg_op = 'DELETE' and v_entity = 'project' then
    v_project := null;
  end if;

  insert into public.activity_log (company_id, actor_id, action, entity_type, entity_id, entity_label, project_id, is_finance, metadata)
  values (
    (v_row ->> 'company_id')::uuid,
    auth.uid(),
    v_action,
    v_entity,
    (v_row ->> 'id')::uuid,
    left(v_row ->> v_label_col, 200),
    v_project,
    v_finance,
    v_meta
  );
  return null;
exception
  -- the project may have been deleted in the same cascade
  when foreign_key_violation then
    return null;
end;
$$;

create trigger projects_activity after insert or update or delete on public.projects
  for each row execute function private.log_activity('project', 'name');
create trigger clients_activity after insert or update or delete on public.clients
  for each row execute function private.log_activity('client', 'name');
create trigger tasks_activity after insert or update or delete on public.tasks
  for each row execute function private.log_activity('task', 'title');
create trigger events_activity after insert or update or delete on public.events
  for each row execute function private.log_activity('event', 'title');
create trigger files_activity after insert or delete on public.files
  for each row execute function private.log_activity('file', 'name');
create trigger comments_activity after insert on public.comments
  for each row execute function private.log_activity('comment', 'body');
create trigger quotes_activity after insert or update or delete on public.quotes
  for each row execute function private.log_activity('quote', 'title', 'true');
create trigger receivables_activity after insert or update or delete on public.receivables
  for each row execute function private.log_activity('receivable', 'concept', 'true');
create trigger payments_activity after insert or delete on public.payments
  for each row execute function private.log_activity('payment', 'reference', 'true');
create trigger expenses_activity after insert or update or delete on public.expenses
  for each row execute function private.log_activity('expense', 'concept', 'true');

-- ---------------------------------------------------------------------------
-- Global search. security invoker: RLS filters every branch, so a user only
-- ever finds what they could already open.
-- ---------------------------------------------------------------------------
create or replace function public.global_search(p_company uuid, p_query text)
returns table (kind text, id uuid, title text, subtitle text, link text)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select '%' || lower(trim(p_query)) || '%' as pattern)
  (select 'client', c.id, c.name, coalesce(c.contact_name, c.email), '/clientes/' || c.id
   from public.clients c, q
   where c.company_id = p_company and c.archived_at is null
     and (lower(c.name) like q.pattern or lower(coalesce(c.contact_name, '')) like q.pattern or lower(coalesce(c.email, '')) like q.pattern)
   order by c.name limit 6)
  union all
  (select 'project', p.id, p.name, p.status::text, '/proyectos/' || p.id
   from public.projects p, q
   where p.company_id = p_company and p.archived_at is null and lower(p.name) like q.pattern
   order by p.updated_at desc limit 6)
  union all
  (select 'task', t.id, t.title, t.status::text, '/tareas?tarea=' || t.id
   from public.tasks t, q
   where t.company_id = p_company and lower(t.title) like q.pattern
   order by t.updated_at desc limit 6)
  union all
  (select 'file', f.id, f.name, f.category::text, '/documentos?archivo=' || f.id
   from public.files f, q
   where f.company_id = p_company and lower(f.name) like q.pattern
   order by f.created_at desc limit 6);
$$;

revoke execute on function public.global_search(uuid, text) from public, anon;
grant execute on function public.global_search(uuid, text) to authenticated;

-- Realtime for the notification bell.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
