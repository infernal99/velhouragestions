-- Documents can be deactivated: they stay stored and visible, but marked as inactive.
alter table public.files add column disabled_at timestamptz;
