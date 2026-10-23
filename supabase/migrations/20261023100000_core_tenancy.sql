-- Core multi-tenant model: every business row belongs to a company, and a
-- user only reaches a company's data through a membership. Access helpers
-- live in the `private` schema so they are callable from RLS policies but
-- not exposed through the PostgREST API.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('admin', 'member');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_url text,
  job_title text,
  phone text,
  active_company_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_len check (char_length(full_name) <= 120),
  constraint profiles_job_title_len check (job_title is null or char_length(job_title) <= 120)
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep profile email in sync when the user changes it in Auth.
create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  primary_color text not null default '#4f46e5',
  currency text not null default 'EUR',
  locale text not null default 'es-ES',
  date_format text not null default 'dd/MM/yyyy',
  timezone text not null default 'Europe/Madrid',
  legal_name text,
  tax_id text,
  address text,
  city text,
  postal_code text,
  country text default 'España',
  email text,
  phone text,
  website text,
  quote_prefix text not null default 'P',
  next_quote_number integer not null default 1,
  default_tax_rate numeric(5, 2) not null default 21.00,
  project_types text[] not null default array['web', 'aplicacion', 'mantenimiento', 'diseno', 'marketing', 'otro'],
  project_status_labels jsonb not null default '{}'::jsonb,
  -- notification + privacy preferences, see src/lib/validation/settings.ts
  preferences jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_name_len check (char_length(name) between 1 and 120),
  constraint companies_color_hex check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint companies_currency check (currency ~ '^[A-Z]{3}$'),
  constraint companies_quote_number_positive check (next_quote_number > 0),
  constraint companies_tax_rate check (default_tax_rate between 0 and 100),
  constraint companies_quote_prefix_len check (char_length(quote_prefix) between 1 and 10)
);

create trigger companies_updated_at before update on public.companies
  for each row execute function private.set_updated_at();

alter table public.profiles
  add constraint profiles_active_company_fk
  foreign key (active_company_id) references public.companies (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Memberships
-- ---------------------------------------------------------------------------
create table public.memberships (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  -- fine-grained grants an admin can hand to a member
  can_view_finances boolean not null default false,
  can_manage_clients boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id);

create trigger memberships_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers (security definer: they read memberships without RLS
-- recursion). All of them key off auth.uid().
-- ---------------------------------------------------------------------------
create or replace function private.is_member(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.company_id = p_company and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_admin(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.company_id = p_company
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
  );
$$;

create or replace function private.can_view_finances(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.company_id = p_company
      and m.user_id = (select auth.uid())
      and (m.role = 'admin' or m.can_view_finances)
  );
$$;

create or replace function private.can_manage_clients(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.company_id = p_company
      and m.user_id = (select auth.uid())
      and (m.role = 'admin' or m.can_manage_clients)
  );
$$;

-- Two users share a company (used to let teammates see each other's profile).
create or replace function private.shares_company(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.company_id = mine.company_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user
  );
$$;

grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Guard rails on memberships: a company always keeps at least one admin.
-- ---------------------------------------------------------------------------
create or replace function private.ensure_admin_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := coalesce(old.company_id, new.company_id);
begin
  if not exists (
    select 1 from public.memberships
    where company_id = v_company and role = 'admin'
  ) and exists (select 1 from public.companies where id = v_company) then
    raise exception 'La empresa debe tener al menos un administrador'
      using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create constraint trigger memberships_keep_admin
  after update or delete on public.memberships
  deferrable initially deferred
  for each row execute function private.ensure_admin_remains();

-- ---------------------------------------------------------------------------
-- Invitations. Only a SHA-256 hash of the token is stored; the raw token
-- travels in the invite link only.
-- ---------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null,
  role public.member_role not null default 'member',
  token_hash text not null unique,
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create index invitations_company_idx on public.invitations (company_id);
create unique index invitations_one_pending_per_email
  on public.invitations (company_id, lower(email))
  where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Create a company and make the caller its first admin.
create or replace function public.create_company(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_company uuid;
begin
  if v_user is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'El nombre de la empresa es obligatorio' using errcode = '22023';
  end if;

  insert into public.companies (name, created_by)
  values (trim(p_name), v_user)
  returning id into v_company;

  insert into public.memberships (company_id, user_id, role)
  values (v_company, v_user, 'admin');

  update public.profiles set active_company_id = v_company where id = v_user;

  return v_company;
end;
$$;

-- Accept an invitation. The invite is bound to an email address: the
-- signed-in user's email must match it.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_inv public.invitations%rowtype;
begin
  if v_user is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = v_user;

  select * into v_inv
  from public.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'Invitación no válida' using errcode = 'P0002';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'La invitación ha sido revocada' using errcode = 'P0001';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'La invitación ya se ha utilizado' using errcode = 'P0001';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'La invitación ha caducado' using errcode = 'P0001';
  end if;
  if lower(v_inv.email) <> lower(coalesce(v_email, '')) then
    raise exception 'Esta invitación es para otra dirección de correo' using errcode = '42501';
  end if;

  insert into public.memberships (company_id, user_id, role)
  values (v_inv.company_id, v_user, v_inv.role)
  on conflict (company_id, user_id) do nothing;

  update public.invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;

  update public.profiles set active_company_id = v_inv.company_id where id = v_user;

  return v_inv.company_id;
end;
$$;

-- Public, minimal lookup used by the invite landing page (company name and
-- invited email only — nothing else about the company leaks).
create or replace function public.invitation_preview(p_token text)
returns table (company_name text, email text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name,
         i.email,
         case
           when i.revoked_at is not null then 'revoked'
           when i.accepted_at is not null then 'accepted'
           when i.expires_at < now() then 'expired'
           else 'pending'
         end
  from public.invitations i
  join public.companies c on c.id = i.company_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

revoke execute on function public.create_company(text) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.create_company(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.invitation_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;

create policy "profiles: self or teammates can read" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_company(id));

create policy "profiles: self update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (active_company_id is null or private.is_member(active_company_id))
  );

create policy "companies: members read" on public.companies
  for select to authenticated
  using (private.is_member(id));

create policy "companies: admins update" on public.companies
  for update to authenticated
  using (private.is_admin(id))
  with check (private.is_admin(id));

create policy "memberships: members read own company" on public.memberships
  for select to authenticated
  using (private.is_member(company_id));

create policy "memberships: admins update" on public.memberships
  for update to authenticated
  using (private.is_admin(company_id))
  with check (private.is_admin(company_id));

create policy "memberships: admins remove, members leave" on public.memberships
  for delete to authenticated
  using (private.is_admin(company_id) or user_id = (select auth.uid()));

create policy "invitations: admins read" on public.invitations
  for select to authenticated
  using (private.is_admin(company_id));

create policy "invitations: admins create" on public.invitations
  for insert to authenticated
  with check (private.is_admin(company_id) and invited_by = (select auth.uid()));

create policy "invitations: admins update" on public.invitations
  for update to authenticated
  using (private.is_admin(company_id))
  with check (private.is_admin(company_id));
