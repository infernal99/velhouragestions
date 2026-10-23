-- Closed registration: an account can only exist if its email is on the
-- allow-list. This is enforced inside Postgres, so it holds even if someone
-- calls Supabase Auth's public signup endpoint directly (the project's
-- "allow new users to sign up" switch is irrelevant).
--
-- Add a person with:  npm run user:create -- <email> "<Nombre>" <contraseña>

create table public.allowed_emails (
  email text primary key,
  note text,
  created_at timestamptz not null default now(),
  constraint allowed_emails_lowercase check (email = lower(email))
);

-- RLS on with no policies: invisible and unwritable through the API.
alter table public.allowed_emails enable row level security;
revoke all on public.allowed_emails from anon, authenticated;

create or replace function private.enforce_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null
     or not exists (select 1 from public.allowed_emails a where a.email = lower(new.email)) then
    raise exception 'El registro está cerrado: este correo no tiene acceso.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger auth_users_closed_signup
  before insert or update of email on auth.users
  for each row execute function private.enforce_allowed_email();
