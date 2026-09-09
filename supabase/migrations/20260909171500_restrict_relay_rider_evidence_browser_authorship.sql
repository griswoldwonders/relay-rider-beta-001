-- Relay Rider-originated evidence is a governed server-side projection from the
-- canonical Django domain. Browser roles may continue to author external
-- institutional evidence under existing RLS policies, but they must not forge,
-- mutate, provenance-downgrade, or delete rows whose provenance identifies
-- Relay Rider as the source.
--
-- This migration intentionally does not change Rule 2202 formulas or the
-- existing organization-scoped RLS policy surface.

create or replace function private.enforce_relay_rider_evidence_server_authority()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  old_source text;
  new_source text;
begin
  if TG_OP <> 'INSERT' then
    old_source := old.original_payload ->> 'source_system';
  end if;
  if TG_OP <> 'DELETE' then
    new_source := new.original_payload ->> 'source_system';
  end if;

  if current_user in ('anon', 'authenticated')
     and (old_source = 'relay_rider' or new_source = 'relay_rider') then
    raise exception using
      errcode = '42501',
      message = 'Relay Rider-originated evidence is server-projected and read-only through browser roles';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_relay_rider_evidence_server_authority() from public;
revoke all on function private.enforce_relay_rider_evidence_server_authority() from anon;
revoke all on function private.enforce_relay_rider_evidence_server_authority() from authenticated;

drop trigger if exists enforce_relay_rider_evidence_server_authority
  on public.evidence_commute_observations;

create trigger enforce_relay_rider_evidence_server_authority
BEFORE INSERT OR UPDATE OR DELETE on public.evidence_commute_observations
for each row
execute function private.enforce_relay_rider_evidence_server_authority();
