-- Tasks (with subtasks + checklist), comments, calendar events.
--
-- Calendar design: tasks with a due date are shown on the calendar straight
-- from the tasks table; they are never copied into events. An event can
-- optionally point at a task (e.g. a scheduled work block) but the deadline
-- itself has a single source of truth, so views never duplicate it.

create type public.task_status as enum ('pendiente', 'en_progreso', 'revision', 'bloqueada', 'completada');
create type public.event_category as enum (
  'reunion', 'entrega', 'tarea', 'llamada', 'revision', 'renovacion', 'recordatorio', 'otro'
);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  parent_id uuid references public.tasks (id) on delete cascade,
  title text not null,
  description text,
  status public.task_status not null default 'pendiente',
  priority public.priority not null default 'media',
  due_date date,
  assignee_id uuid references public.profiles (id) on delete set null,
  labels text[] not null default '{}',
  position double precision not null default 0,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_len check (char_length(title) between 1 and 300),
  constraint tasks_not_own_parent check (parent_id is null or parent_id <> id),
  constraint tasks_labels_count check (coalesce(array_length(labels, 1), 0) <= 20)
);

create index tasks_company_status_idx on public.tasks (company_id, status);
create index tasks_project_idx on public.tasks (project_id, status);
create index tasks_assignee_idx on public.tasks (assignee_id, status);
create index tasks_due_idx on public.tasks (company_id, due_date) where status <> 'completada';
create index tasks_parent_idx on public.tasks (parent_id);
create index tasks_title_trgm_idx on public.tasks using gin (lower(title) extensions.gin_trgm_ops);

create trigger tasks_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();

create table public.task_collaborators (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (task_id, user_id)
);

create index task_collaborators_user_idx on public.task_collaborators (user_id);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint task_checklist_label_len check (char_length(label) between 1 and 300)
);

create index task_checklist_task_idx on public.task_checklist_items (task_id, position);

-- Standalone tasks (no project) are internal to the company and visible to
-- every member; project tasks follow project access.
create or replace function private.can_access_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_task
      and private.is_member(t.company_id)
      and (
        t.project_id is null
        or private.can_access_project(t.project_id)
        or t.assignee_id = (select auth.uid())
        or exists (
          select 1 from public.task_collaborators tc
          where tc.task_id = t.id and tc.user_id = (select auth.uid())
        )
      )
  );
$$;

grant execute on function private.can_access_task(uuid) to authenticated;

-- Consistency: project, parent and people must belong to the task's company;
-- a subtask inherits its parent's project; completed_at follows status.
create or replace function private.prepare_task()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent public.tasks%rowtype;
begin
  if new.parent_id is not null then
    select * into v_parent from public.tasks where id = new.parent_id;
    if not found or v_parent.company_id <> new.company_id then
      raise exception 'La tarea padre no es válida' using errcode = '23514';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'Solo se admite un nivel de subtareas' using errcode = '23514';
    end if;
    new.project_id := v_parent.project_id;
  end if;

  if new.project_id is not null and not exists (
    select 1 from public.projects p where p.id = new.project_id and p.company_id = new.company_id
  ) then
    raise exception 'El proyecto no pertenece a esta empresa' using errcode = '23514';
  end if;

  if new.assignee_id is not null and not exists (
    select 1 from public.memberships m where m.user_id = new.assignee_id and m.company_id = new.company_id
  ) then
    raise exception 'El responsable no es miembro de la empresa' using errcode = '23514';
  end if;

  if new.status = 'completada' and (tg_op = 'INSERT' or old.status <> 'completada') then
    new.completed_at := now();
  elsif new.status <> 'completada' then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger tasks_prepare
  before insert or update on public.tasks
  for each row execute function private.prepare_task();

-- Project progress = completed top-level tasks / all top-level tasks.
create or replace function private.recalc_project_progress(p_project uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.projects p
  set progress = coalesce((
    select round(100.0 * count(*) filter (where t.status = 'completada') / nullif(count(*), 0))
    from public.tasks t
    where t.project_id = p_project and t.parent_id is null
  ), 0)
  where p.id = p_project;
$$;

create or replace function private.tasks_progress_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.project_id is not null then
    perform private.recalc_project_progress(old.project_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.project_id is not null
     and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id
          or new.status is distinct from old.status or new.parent_id is distinct from old.parent_id) then
    perform private.recalc_project_progress(new.project_id);
  end if;
  return null;
end;
$$;

create trigger tasks_progress
  after insert or update or delete on public.tasks
  for each row execute function private.tasks_progress_trigger();

create or replace function private.check_task_collaborator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.tasks t
    join public.memberships m on m.company_id = t.company_id
    where t.id = new.task_id and m.user_id = new.user_id
  ) then
    raise exception 'El colaborador no es miembro de la empresa' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger task_collaborators_check
  before insert or update on public.task_collaborators
  for each row execute function private.check_task_collaborator();

-- ---------------------------------------------------------------------------
-- Comments (exactly one parent: project, task or client)
-- ---------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  body text not null,
  author_id uuid references public.profiles (id) on delete set null,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  constraint comments_one_parent check (num_nonnulls(project_id, task_id, client_id) = 1),
  constraint comments_body_len check (char_length(body) between 1 and 10000)
);

create index comments_project_idx on public.comments (project_id, created_at);
create index comments_task_idx on public.comments (task_id, created_at);
create index comments_client_idx on public.comments (client_id, created_at);

create or replace function private.can_access_comment_parent(
  p_project uuid, p_task uuid, p_client uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_project is not null then private.can_access_project(p_project)
    when p_task is not null then private.can_access_task(p_task)
    when p_client is not null then private.can_access_client(p_client)
    else false
  end;
$$;

grant execute on function private.can_access_comment_parent(uuid, uuid, uuid) to authenticated;

create or replace function private.check_comment_company()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.project_id is not null and not exists (select 1 from public.projects where id = new.project_id and company_id = new.company_id))
     or (new.task_id is not null and not exists (select 1 from public.tasks where id = new.task_id and company_id = new.company_id))
     or (new.client_id is not null and not exists (select 1 from public.clients where id = new.client_id and company_id = new.company_id)) then
    raise exception 'El elemento comentado no pertenece a esta empresa' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger comments_check_company
  before insert or update on public.comments
  for each row execute function private.check_comment_company();

-- ---------------------------------------------------------------------------
-- Calendar events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null,
  description text,
  category public.event_category not null default 'reunion',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  project_id uuid references public.projects (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  color text,
  -- Reserved for a future Google Calendar sync (not implemented yet).
  external_provider text,
  external_id text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_title_len check (char_length(title) between 1 and 200),
  constraint events_range check (ends_at >= starts_at),
  constraint events_color_hex check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  constraint events_external_unique unique (company_id, external_provider, external_id)
);

create index events_company_range_idx on public.events (company_id, starts_at, ends_at);
create index events_project_idx on public.events (project_id);

create trigger events_updated_at before update on public.events
  for each row execute function private.set_updated_at();

create table public.event_attendees (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (event_id, user_id)
);

create index event_attendees_user_idx on public.event_attendees (user_id);

-- Events tied to a project follow project access; the rest are visible to
-- the whole company (internal calendar).
create or replace function private.can_access_event(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event
      and private.is_member(e.company_id)
      and (
        e.project_id is null
        or private.can_access_project(e.project_id)
        or e.created_by = (select auth.uid())
        or exists (select 1 from public.event_attendees a where a.event_id = e.id and a.user_id = (select auth.uid()))
      )
  );
$$;

grant execute on function private.can_access_event(uuid) to authenticated;

create or replace function private.check_event_refs()
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

create trigger events_check_refs
  before insert or update on public.events
  for each row execute function private.check_event_refs();

create or replace function private.check_event_attendee()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.events e
    join public.memberships m on m.company_id = e.company_id
    where e.id = new.event_id and m.user_id = new.user_id
  ) then
    raise exception 'El participante no es miembro de la empresa' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger event_attendees_check
  before insert or update on public.event_attendees
  for each row execute function private.check_event_attendee();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.task_collaborators enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.comments enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;

create policy "tasks: read accessible" on public.tasks
  for select to authenticated
  using (
    (private.is_member(company_id) and (created_by = (select auth.uid()) or assignee_id = (select auth.uid())))
    or private.can_access_task(id)
  );
create policy "tasks: create" on public.tasks
  for insert to authenticated
  with check (
    private.is_member(company_id)
    and created_by = (select auth.uid())
    and (project_id is null or private.can_access_project(project_id))
  );
create policy "tasks: update accessible" on public.tasks
  for update to authenticated
  using (private.can_access_task(id))
  with check (
    private.is_member(company_id)
    and (project_id is null or private.can_access_project(project_id))
  );
create policy "tasks: delete by creator or manager" on public.tasks
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    or private.is_admin(company_id)
    or (project_id is not null and private.can_manage_project(project_id))
  );

create policy "task_collaborators: read" on public.task_collaborators
  for select to authenticated using (private.can_access_task(task_id));
create policy "task_collaborators: write" on public.task_collaborators
  for all to authenticated
  using (private.can_access_task(task_id))
  with check (private.can_access_task(task_id));

create policy "task_checklist: read" on public.task_checklist_items
  for select to authenticated using (private.can_access_task(task_id));
create policy "task_checklist: write" on public.task_checklist_items
  for all to authenticated
  using (private.can_access_task(task_id))
  with check (private.can_access_task(task_id));

create policy "comments: read via parent" on public.comments
  for select to authenticated
  using (private.can_access_comment_parent(project_id, task_id, client_id));
create policy "comments: create via parent" on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.is_member(company_id)
    and private.can_access_comment_parent(project_id, task_id, client_id)
  );
create policy "comments: author edits" on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "comments: author or admin deletes" on public.comments
  for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_admin(company_id));

create policy "events: read accessible" on public.events
  for select to authenticated
  using (
    (private.is_member(company_id) and created_by = (select auth.uid()))
    or private.can_access_event(id)
  );
create policy "events: create" on public.events
  for insert to authenticated
  with check (
    private.is_member(company_id)
    and created_by = (select auth.uid())
    and (project_id is null or private.can_access_project(project_id))
  );
create policy "events: update accessible" on public.events
  for update to authenticated
  using (private.can_access_event(id))
  with check (private.is_member(company_id));
create policy "events: delete by creator or admin" on public.events
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin(company_id));

create policy "event_attendees: read" on public.event_attendees
  for select to authenticated using (private.can_access_event(event_id));
create policy "event_attendees: write" on public.event_attendees
  for all to authenticated
  using (private.can_access_event(event_id))
  with check (private.can_access_event(event_id));
