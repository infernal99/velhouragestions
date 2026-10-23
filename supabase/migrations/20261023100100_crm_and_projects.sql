-- CRM (clients + communication log) and projects, including the web
-- development specifics (stages, change requests, review checklist and
-- references to secrets kept in an external vault).

create type public.crm_stage as enum (
  'nuevo', 'contactado', 'reunion', 'propuesta', 'negociacion', 'ganado', 'perdido'
);
create type public.interaction_kind as enum ('llamada', 'reunion', 'mensaje', 'email', 'acuerdo', 'nota');
create type public.project_status as enum (
  'pendiente', 'planificado', 'en_desarrollo', 'revision', 'entregado', 'pausado', 'cancelado'
);
create type public.priority as enum ('baja', 'media', 'alta', 'urgente');
create type public.web_type as enum ('landing', 'tienda', 'corporativa', 'portfolio', 'otra');
create type public.web_request_kind as enum ('cambio', 'problema');
create type public.web_request_status as enum ('abierto', 'en_curso', 'resuelto', 'descartado');
create type public.link_kind as enum ('github', 'vercel', 'dominio', 'staging', 'produccion', 'documentacion', 'diseno', 'otro');

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  legal_name text,
  tax_id text,
  address text,
  website text,
  sector text,
  stage public.crm_stage not null default 'nuevo',
  source text,
  owner_id uuid references public.profiles (id) on delete set null,
  notes text,
  next_action text,
  next_action_date date,
  estimated_value numeric(12, 2),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_name_len check (char_length(name) between 1 and 160),
  constraint clients_email_format check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint clients_estimated_value_positive check (estimated_value is null or estimated_value >= 0)
);

create index clients_company_stage_idx on public.clients (company_id, stage) where archived_at is null;
create index clients_owner_idx on public.clients (owner_id);
create index clients_followup_idx on public.clients (company_id, next_action_date) where next_action_date is not null;
create index clients_name_trgm_idx on public.clients using gin (lower(name) extensions.gin_trgm_ops);

create trigger clients_updated_at before update on public.clients
  for each row execute function private.set_updated_at();

create table public.client_interactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  kind public.interaction_kind not null,
  summary text not null,
  occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint client_interactions_summary_len check (char_length(summary) between 1 and 5000)
);

create index client_interactions_client_idx on public.client_interactions (client_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  name text not null,
  description text,
  type text not null default 'web',
  status public.project_status not null default 'pendiente',
  priority public.priority not null default 'media',
  start_date date,
  due_date date,
  budget numeric(12, 2),
  owner_id uuid references public.profiles (id) on delete set null,
  -- maintained by trigger from top-level tasks
  progress smallint not null default 0,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_len check (char_length(name) between 1 and 160),
  constraint projects_dates check (start_date is null or due_date is null or due_date >= start_date),
  constraint projects_budget_positive check (budget is null or budget >= 0),
  constraint projects_progress_range check (progress between 0 and 100)
);

create index projects_company_status_idx on public.projects (company_id, status) where archived_at is null;
create index projects_client_idx on public.projects (client_id);
create index projects_owner_idx on public.projects (owner_id);
create index projects_due_idx on public.projects (company_id, due_date) where archived_at is null;
create index projects_name_trgm_idx on public.projects using gin (lower(name) extensions.gin_trgm_ops);

create trigger projects_updated_at before update on public.projects
  for each row execute function private.set_updated_at();

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_members_user_idx on public.project_members (user_id);

create table public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind public.link_kind not null default 'otro',
  label text not null,
  url text not null,
  created_at timestamptz not null default now(),
  constraint project_links_url check (url ~* '^https?://'),
  constraint project_links_label_len check (char_length(label) between 1 and 120)
);

create index project_links_project_idx on public.project_links (project_id);

-- ---------------------------------------------------------------------------
-- Project access
-- ---------------------------------------------------------------------------
create or replace function private.can_access_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.memberships m
      on m.company_id = p.company_id and m.user_id = (select auth.uid())
    where p.id = p_project
      and (
        m.role = 'admin'
        or p.owner_id = (select auth.uid())
        or p.created_by = (select auth.uid())
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = (select auth.uid())
        )
      )
  );
$$;

-- Can manage = admin or the project's owner.
create or replace function private.can_manage_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.memberships m
      on m.company_id = p.company_id and m.user_id = (select auth.uid())
    where p.id = p_project
      and (m.role = 'admin' or p.owner_id = (select auth.uid()))
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
    select 1
    from public.clients c
    join public.memberships m
      on m.company_id = c.company_id and m.user_id = (select auth.uid())
    where c.id = p_client
      and (
        m.role = 'admin'
        or m.can_manage_clients
        or c.owner_id = (select auth.uid())
        or c.created_by = (select auth.uid())
        or exists (
          select 1 from public.projects p
          where p.client_id = c.id and private.can_access_project(p.id)
        )
      )
  );
$$;

grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Web development specifics
-- ---------------------------------------------------------------------------
create table public.web_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  position smallint not null,
  color text not null default '#64748b',
  created_at timestamptz not null default now(),
  constraint web_stages_name_len check (char_length(name) between 1 and 60),
  constraint web_stages_color_hex check (color ~ '^#[0-9a-fA-F]{6}$'),
  constraint web_stages_position_unique unique (company_id, position) deferrable initially deferred
);

create table public.web_details (
  project_id uuid primary key references public.projects (id) on delete cascade,
  web_type public.web_type not null default 'corporativa',
  stage_id uuid references public.web_stages (id) on delete set null,
  dev_url text,
  production_url text,
  repository_url text,
  domain text,
  hosting_provider text,
  domain_renewal_date date,
  requirements text,
  updated_at timestamptz not null default now(),
  constraint web_details_dev_url check (dev_url is null or dev_url ~* '^https?://'),
  constraint web_details_prod_url check (production_url is null or production_url ~* '^https?://'),
  constraint web_details_repo_url check (repository_url is null or repository_url ~* '^https?://')
);

create index web_details_stage_idx on public.web_details (stage_id);

create trigger web_details_updated_at before update on public.web_details
  for each row execute function private.set_updated_at();

create table public.web_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind public.web_request_kind not null default 'cambio',
  title text not null,
  description text,
  priority public.priority not null default 'media',
  status public.web_request_status not null default 'abierto',
  assignee_id uuid references public.profiles (id) on delete set null,
  requested_by_client boolean not null default true,
  resolved_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_requests_title_len check (char_length(title) between 1 and 200)
);

create index web_requests_project_idx on public.web_requests (project_id, status);

create trigger web_requests_updated_at before update on public.web_requests
  for each row execute function private.set_updated_at();

create table public.web_checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  done_by uuid references public.profiles (id) on delete set null,
  done_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint web_checklist_label_len check (char_length(label) between 1 and 200)
);

create index web_checklist_project_idx on public.web_checklist_items (project_id, position);

-- Credentials are NEVER stored here. A row only says where the secret lives
-- (e.g. a 1Password/Bitwarden item URL or a vault path).
create table public.secret_references (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null,
  vault_provider text not null,
  vault_reference text not null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint secret_references_label_len check (char_length(label) between 1 and 120),
  constraint secret_references_ref_len check (char_length(vault_reference) between 1 and 500)
);

create index secret_references_project_idx on public.secret_references (project_id);

-- Seed default web stages for every new company.
create or replace function private.seed_company_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.web_stages (company_id, name, position, color) values
    (new.id, 'Captación', 1, '#64748b'),
    (new.id, 'Presupuesto', 2, '#a855f7'),
    (new.id, 'Diseño', 3, '#ec4899'),
    (new.id, 'Desarrollo', 4, '#3b82f6'),
    (new.id, 'Revisión interna', 5, '#f59e0b'),
    (new.id, 'Revisión del cliente', 6, '#f97316'),
    (new.id, 'Publicación', 7, '#22c55e'),
    (new.id, 'Mantenimiento', 8, '#14b8a6');
  return new;
end;
$$;

create trigger companies_seed_defaults
  after insert on public.companies
  for each row execute function private.seed_company_defaults();

-- web_details.stage_id must belong to the project's own company.
create or replace function private.check_web_stage_company()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage_id is not null and not exists (
    select 1
    from public.web_stages s
    join public.projects p on p.company_id = s.company_id
    where s.id = new.stage_id and p.id = new.project_id
  ) then
    raise exception 'La etapa no pertenece a esta empresa' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger web_details_stage_company
  before insert or update of stage_id on public.web_details
  for each row execute function private.check_web_stage_company();

-- ---------------------------------------------------------------------------
-- Cross-tenant consistency: a project's client must be from the same company.
-- ---------------------------------------------------------------------------
create or replace function private.check_project_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.client_id is not null and not exists (
    select 1 from public.clients c where c.id = new.client_id and c.company_id = new.company_id
  ) then
    raise exception 'El cliente no pertenece a esta empresa' using errcode = '23514';
  end if;
  if new.owner_id is not null and not exists (
    select 1 from public.memberships m where m.user_id = new.owner_id and m.company_id = new.company_id
  ) then
    raise exception 'El responsable no es miembro de la empresa' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger projects_check_refs
  before insert or update of client_id, owner_id, company_id on public.projects
  for each row execute function private.check_project_refs();

create or replace function private.check_project_member_company()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.projects p
    join public.memberships m on m.company_id = p.company_id
    where p.id = new.project_id and m.user_id = new.user_id
  ) then
    raise exception 'El colaborador no es miembro de la empresa' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger project_members_check_company
  before insert or update on public.project_members
  for each row execute function private.check_project_member_company();

create or replace function private.check_client_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is not null and not exists (
    select 1 from public.memberships m where m.user_id = new.owner_id and m.company_id = new.company_id
  ) then
    raise exception 'El responsable no es miembro de la empresa' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger clients_check_refs
  before insert or update of owner_id, company_id on public.clients
  for each row execute function private.check_client_refs();

create or replace function private.check_interaction_company()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.clients c where c.id = new.client_id and c.company_id = new.company_id
  ) then
    raise exception 'El cliente no pertenece a esta empresa' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger client_interactions_check_company
  before insert or update on public.client_interactions
  for each row execute function private.check_interaction_company();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.client_interactions enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_links enable row level security;
alter table public.web_stages enable row level security;
alter table public.web_details enable row level security;
alter table public.web_requests enable row level security;
alter table public.web_checklist_items enable row level security;
alter table public.secret_references enable row level security;

-- Clients
-- Direct column checks come first: inside INSERT ... RETURNING a stable
-- helper's snapshot cannot see the row being inserted yet.
create policy "clients: read accessible" on public.clients
  for select to authenticated
  using (
    (private.is_member(company_id) and (created_by = (select auth.uid()) or owner_id = (select auth.uid())))
    or private.can_access_client(id)
  );
create policy "clients: members create" on public.clients
  for insert to authenticated
  with check (private.is_member(company_id) and created_by = (select auth.uid()));
create policy "clients: update accessible" on public.clients
  for update to authenticated
  using (private.can_access_client(id))
  with check (private.is_member(company_id));
create policy "clients: managers delete" on public.clients
  for delete to authenticated using (private.can_manage_clients(company_id));

create policy "interactions: read via client" on public.client_interactions
  for select to authenticated using (private.can_access_client(client_id));
create policy "interactions: create via client" on public.client_interactions
  for insert to authenticated
  with check (private.can_access_client(client_id) and created_by = (select auth.uid()));
create policy "interactions: author or manager delete" on public.client_interactions
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.can_manage_clients(company_id));

-- Projects
create policy "projects: read accessible" on public.projects
  for select to authenticated
  using (
    (private.is_member(company_id) and (created_by = (select auth.uid()) or owner_id = (select auth.uid())))
    or private.can_access_project(id)
  );
create policy "projects: members create" on public.projects
  for insert to authenticated
  with check (private.is_member(company_id) and created_by = (select auth.uid()));
create policy "projects: collaborators update" on public.projects
  for update to authenticated
  using (private.can_access_project(id))
  with check (private.is_member(company_id));
create policy "projects: admins delete" on public.projects
  for delete to authenticated using (private.is_admin(company_id));

create policy "project_members: read via project" on public.project_members
  for select to authenticated using (private.can_access_project(project_id));
create policy "project_members: managers add" on public.project_members
  for insert to authenticated with check (private.can_manage_project(project_id));
create policy "project_members: managers remove" on public.project_members
  for delete to authenticated using (private.can_manage_project(project_id));

create policy "project_links: read" on public.project_links
  for select to authenticated using (private.can_access_project(project_id));
create policy "project_links: write" on public.project_links
  for all to authenticated
  using (private.can_access_project(project_id))
  with check (private.can_access_project(project_id));

-- Web
create policy "web_stages: members read" on public.web_stages
  for select to authenticated using (private.is_member(company_id));
create policy "web_stages: admins write" on public.web_stages
  for all to authenticated
  using (private.is_admin(company_id))
  with check (private.is_admin(company_id));

create policy "web_details: read" on public.web_details
  for select to authenticated using (private.can_access_project(project_id));
create policy "web_details: write" on public.web_details
  for all to authenticated
  using (private.can_access_project(project_id))
  with check (private.can_access_project(project_id));

create policy "web_requests: read" on public.web_requests
  for select to authenticated using (private.can_access_project(project_id));
create policy "web_requests: create" on public.web_requests
  for insert to authenticated
  with check (private.can_access_project(project_id) and created_by = (select auth.uid()));
create policy "web_requests: update" on public.web_requests
  for update to authenticated
  using (private.can_access_project(project_id))
  with check (private.can_access_project(project_id));
create policy "web_requests: delete" on public.web_requests
  for delete to authenticated
  using (private.can_manage_project(project_id) or created_by = (select auth.uid()));

create policy "web_checklist: read" on public.web_checklist_items
  for select to authenticated using (private.can_access_project(project_id));
create policy "web_checklist: write" on public.web_checklist_items
  for all to authenticated
  using (private.can_access_project(project_id))
  with check (private.can_access_project(project_id));

create policy "secret_refs: read" on public.secret_references
  for select to authenticated using (private.can_access_project(project_id));
create policy "secret_refs: managers write" on public.secret_references
  for all to authenticated
  using (private.can_manage_project(project_id))
  with check (private.can_manage_project(project_id));
