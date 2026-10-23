-- Replace all lines of a quote in a single transaction, so a failed save
-- never leaves a quote with its lines half deleted. Runs as the caller
-- (RLS + the frozen-lines trigger still apply).

create or replace function public.replace_quote_lines(p_quote uuid, p_lines jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Añade al menos una línea' using errcode = '22023';
  end if;

  delete from public.quote_lines where quote_id = p_quote;

  insert into public.quote_lines (quote_id, position, description, quantity, unit_price, discount_pct, tax_pct)
  select p_quote,
         t.ord::integer,
         t.l ->> 'description',
         (t.l ->> 'quantity')::numeric,
         (t.l ->> 'unit_price')::numeric,
         coalesce((t.l ->> 'discount_pct')::numeric, 0),
         coalesce((t.l ->> 'tax_pct')::numeric, 21)
  from jsonb_array_elements(p_lines) with ordinality as t(l, ord);
end;
$$;

revoke execute on function public.replace_quote_lines(uuid, jsonb) from public, anon;
grant execute on function public.replace_quote_lines(uuid, jsonb) to authenticated;
