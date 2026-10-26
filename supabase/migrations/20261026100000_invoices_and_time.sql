-- 1) Invoice PDFs attached to receivables ("cobros").
-- 2) Time tracking: every member clocks hours against a project; everyone in
--    the company sees all entries (shared workspace), each person edits their own.

alter type public.file_category add value if not exists 'factura';

alter table public.receivables
  add column invoice_file_id uuid references public.files (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Time entries
-- ---------------------------------------------------------------------------
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null,
  -- null while the timer is running
  ended_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_entries_order check (ended_at is null or ended_at >= started_at),
  constraint time_entries_max_24h check (ended_at is null or ended_at <= started_at + interval '24 hours'),
  constraint time_entries_note_len check (note is null or char_length(note) <= 500)
);

create index time_entries_company_start_idx on public.time_entries (company_id, started_at desc);
create index time_entries_project_idx on public.time_entries (project_id, started_at desc);
create index time_entries_user_idx on public.time_entries (user_id, started_at desc);
-- A person can only have one running timer at a time.
create unique index time_entries_one_running_per_user on public.time_entries (user_id) where ended_at is null;

create trigger time_entries_updated_at before update on public.time_entries
  for each row execute function private.set_updated_at();

-- Project and task must belong to the entry's company; the person must be a member.
create or replace function private.check_time_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.projects p where p.id = new.project_id and p.company_id = new.company_id) then
    raise exception 'El proyecto no pertenece a esta empresa' using errcode = '23514';
  end if;
  if new.task_id is not null and not exists (
    select 1 from public.tasks t where t.id = new.task_id and t.company_id = new.company_id
  ) then
    raise exception 'La tarea no pertenece a esta empresa' using errcode = '23514';
  end if;
  if not exists (select 1 from public.memberships m where m.company_id = new.company_id and m.user_id = new.user_id) then
    raise exception 'La persona no es miembro de la empresa' using errcode = '23514';
  end if;
  if new.ended_at is null and new.started_at > now() + interval '5 minutes' then
    raise exception 'Un cronómetro no puede empezar en el futuro' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger time_entries_check
  before insert or update on public.time_entries
  for each row execute function private.check_time_entry();

alter table public.time_entries enable row level security;

create policy "time: team reads" on public.time_entries
  for select to authenticated using (private.is_member(company_id));

create policy "time: clock own hours" on public.time_entries
  for insert to authenticated
  with check (private.is_member(company_id) and user_id = (select auth.uid()));

create policy "time: edit own or admin" on public.time_entries
  for update to authenticated
  using (user_id = (select auth.uid()) or private.is_admin(company_id))
  with check (private.is_member(company_id));

create policy "time: delete own or admin" on public.time_entries
  for delete to authenticated
  using (user_id = (select auth.uid()) or private.is_admin(company_id));

-- Hours worked per project and per person in a range (running timers count up to now).
create or replace function public.time_summary(p_company uuid, p_from timestamptz, p_to timestamptz)
returns table (project_id uuid, user_id uuid, minutes numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.project_id, t.user_id,
         round(sum(extract(epoch from (coalesce(t.ended_at, now()) - t.started_at)) / 60.0), 1)
  from public.time_entries t
  where t.company_id = p_company and t.started_at >= p_from and t.started_at < p_to
  group by t.project_id, t.user_id;
$$;

revoke execute on function public.time_summary(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.time_summary(uuid, timestamptz, timestamptz) to authenticated;
