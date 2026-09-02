-- RR-SEC-001 / RR-SEC-002 / RR-SEC-003
-- Institution membership and tenant-integrity hardening.
--
-- Security model:
--   * authenticated clients may read membership rows through RLS;
--   * membership mutations must use the guarded SECURITY DEFINER RPCs;
--   * a trigger protects owner transitions even when a privileged SQL path is used;
--   * composite foreign keys make tenant/object mismatches impossible.

begin;

-- Fail closed if legacy data already violates tenant ownership. This prevents a
-- migration from silently legitimizing cross-institution associations.
do $migration_guard$
begin
  if exists (
    select 1
    from public.organization_member_sites ms
    join public.organization_sites s on s.id = ms.site_id
    where ms.organization_id <> s.organization_id
  ) then
    raise exception 'Tenant mismatch in organization_member_sites';
  end if;

  if exists (
    select 1
    from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
    where cm.organization_id <> c.organization_id
  ) then
    raise exception 'Tenant mismatch in cohort_members';
  end if;

  if exists (
    select 1
    from public.cohorts c
    join public.organization_sites s on s.id = c.site_id
    where c.site_id is not null and c.organization_id <> s.organization_id
  ) then
    raise exception 'Tenant mismatch in cohorts.site_id';
  end if;

  if exists (
    select 1
    from public.organization_invitations i
    join public.organization_sites s on s.id = i.site_id
    where i.site_id is not null and i.organization_id <> s.organization_id
  ) then
    raise exception 'Tenant mismatch in organization_invitations.site_id';
  end if;

  if exists (
    select 1
    from public.organization_invitations i
    join public.cohorts c on c.id = i.cohort_id
    where i.cohort_id is not null and i.organization_id <> c.organization_id
  ) then
    raise exception 'Tenant mismatch in organization_invitations.cohort_id';
  end if;

  if exists (
    select 1
    from public.commuter_needs n
    join public.cohorts c on c.id = n.cohort_id
    where n.cohort_id is not null and n.organization_id is distinct from c.organization_id
  ) then
    raise exception 'Tenant mismatch in commuter_needs.cohort_id';
  end if;

  if exists (
    select 1
    from public.planned_routes r
    join public.cohorts c on c.id = r.cohort_id
    where r.cohort_id is not null and r.organization_id is distinct from c.organization_id
  ) then
    raise exception 'Tenant mismatch in planned_routes.cohort_id';
  end if;

  if exists (
    select 1
    from public.match_previews m
    join public.commuter_needs n on n.id = m.commuter_need_id
    where m.organization_id is distinct from n.organization_id
  ) then
    raise exception 'Tenant mismatch in match_previews.commuter_need_id';
  end if;

  if exists (
    select 1
    from public.match_previews m
    join public.planned_routes r on r.id = m.planned_route_id
    where m.organization_id is distinct from r.organization_id
  ) then
    raise exception 'Tenant mismatch in match_previews.planned_route_id';
  end if;

  if exists (
    select 1
    from public.match_previews m
    join public.access_points a on a.id = m.access_point_id
    where m.access_point_id is not null
      and m.organization_id is distinct from a.organization_id
  ) then
    raise exception 'Tenant mismatch in match_previews.access_point_id';
  end if;

  if exists (
    select 1
    from public.administrative_reviews ar
    join public.match_previews m on m.id = ar.match_preview_id
    where ar.organization_id is distinct from m.organization_id
  ) then
    raise exception 'Tenant mismatch in administrative_reviews.match_preview_id';
  end if;
end
$migration_guard$;

-- RR-SEC-001/002: table-level membership mutation is not a public API.
revoke insert, update, delete on table public.organization_members from authenticated;
revoke insert, update, delete on table public.organization_members from anon;

drop policy if exists organization_members_admin_insert on public.organization_members;
drop policy if exists organization_members_admin_update on public.organization_members;
drop policy if exists organization_members_admin_delete on public.organization_members;

create or replace function private.enforce_organization_owner_invariants()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  actor_id uuid := auth.uid();
  target_org uuid := coalesce(new.organization_id, old.organization_id);
  removes_active_owner boolean := false;
  creates_active_owner boolean := false;
  changes_owner boolean := false;
  remaining_active_owners integer;
begin
  -- Lock the institution row so concurrent owner removals serialize.
  -- If it no longer exists, this is an organization-level cascade.
  perform 1
  from public.organizations
  where id = target_org
  for update;

  if not found then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    removes_active_owner := old.role = 'owner' and old.status = 'active';
    changes_owner := old.role = 'owner';
  else
    removes_active_owner := old.role = 'owner'
      and old.status = 'active'
      and not (new.role = 'owner' and new.status = 'active');
    creates_active_owner := new.role = 'owner'
      and new.status = 'active'
      and not (old.role = 'owner' and old.status = 'active');
    changes_owner := old.role = 'owner'
      and (new.role is distinct from old.role or new.status is distinct from old.status);

    if new.organization_id is distinct from old.organization_id
       or new.user_id is distinct from old.user_id then
      raise exception using
        errcode = '42501',
        message = 'Membership identity cannot be reassigned';
    end if;
  end if;

  -- A signed-in actor must already be an active owner to create, alter, or
  -- delete an owner membership. Trusted migration/service operations without
  -- an end-user JWT remain possible, but still cannot remove the final owner.
  if actor_id is not null and (creates_active_owner or changes_owner) and not exists (
    select 1
    from public.organization_members actor_membership
    where actor_membership.organization_id = target_org
      and actor_membership.user_id = actor_id
      and actor_membership.role = 'owner'
      and actor_membership.status = 'active'
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only an active owner may change owner memberships';
  end if;

  if removes_active_owner then
    select count(*)
    into remaining_active_owners
    from public.organization_members candidate
    where candidate.organization_id = target_org
      and candidate.role = 'owner'
      and candidate.status = 'active'
      and candidate.user_id <> old.user_id;

    if remaining_active_owners < 1 then
      raise exception using
        errcode = '23514',
        message = 'Organization must retain at least one active owner';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end
$function$;

revoke all on function private.enforce_organization_owner_invariants() from public;
revoke all on function private.enforce_organization_owner_invariants() from anon;
revoke all on function private.enforce_organization_owner_invariants() from authenticated;

drop trigger if exists enforce_organization_owner_invariants
  on public.organization_members;
create trigger enforce_organization_owner_invariants
before update or delete on public.organization_members
for each row execute function private.enforce_organization_owner_invariants();

-- Parent-side composite keys. The id remains the primary key; these additional
-- keys exist so every child can prove that its object belongs to its tenant.
alter table public.organization_sites
  add constraint organization_sites_organization_id_id_key
  unique (organization_id, id);

alter table public.cohorts
  add constraint cohorts_organization_id_id_key
  unique (organization_id, id);

alter table public.commuter_needs
  add constraint commuter_needs_organization_id_id_key
  unique (organization_id, id);

alter table public.planned_routes
  add constraint planned_routes_organization_id_id_key
  unique (organization_id, id);

alter table public.access_points
  add constraint access_points_organization_id_id_key
  unique (organization_id, id);

alter table public.match_previews
  add constraint match_previews_organization_id_id_key
  unique (organization_id, id);

-- Tenant-consistent assignments.
alter table public.organization_member_sites
  add constraint organization_member_sites_tenant_site_fkey
  foreign key (organization_id, site_id)
  references public.organization_sites (organization_id, id)
  on delete cascade;

alter table public.cohort_members
  add constraint cohort_members_tenant_cohort_fkey
  foreign key (organization_id, cohort_id)
  references public.cohorts (organization_id, id)
  on delete cascade;

alter table public.cohorts
  add constraint cohorts_tenant_site_fkey
  foreign key (organization_id, site_id)
  references public.organization_sites (organization_id, id)
  on delete set null (site_id);

alter table public.organization_invitations
  add constraint organization_invitations_tenant_site_fkey
  foreign key (organization_id, site_id)
  references public.organization_sites (organization_id, id)
  on delete set null (site_id);

alter table public.organization_invitations
  add constraint organization_invitations_tenant_cohort_fkey
  foreign key (organization_id, cohort_id)
  references public.cohorts (organization_id, id)
  on delete set null (cohort_id);

alter table public.commuter_needs
  add constraint commuter_needs_tenant_cohort_fkey
  foreign key (organization_id, cohort_id)
  references public.cohorts (organization_id, id)
  on delete set null (cohort_id);

alter table public.planned_routes
  add constraint planned_routes_tenant_cohort_fkey
  foreign key (organization_id, cohort_id)
  references public.cohorts (organization_id, id)
  on delete set null (cohort_id);

alter table public.match_previews
  add constraint match_previews_tenant_need_fkey
  foreign key (organization_id, commuter_need_id)
  references public.commuter_needs (organization_id, id)
  on delete cascade;

alter table public.match_previews
  add constraint match_previews_tenant_route_fkey
  foreign key (organization_id, planned_route_id)
  references public.planned_routes (organization_id, id)
  on delete cascade;

alter table public.match_previews
  add constraint match_previews_tenant_access_point_fkey
  foreign key (organization_id, access_point_id)
  references public.access_points (organization_id, id)
  on delete set null (access_point_id);

alter table public.administrative_reviews
  add constraint administrative_reviews_tenant_preview_fkey
  foreign key (organization_id, match_preview_id)
  references public.match_previews (organization_id, id)
  on delete cascade;

commit;
