\set ON_ERROR_STOP on

-- Rollback-safe regression suite for RR-SEC-001 through RR-SEC-003.
-- Every fixture and attempted mutation is contained in this transaction.
begin;

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void
language plpgsql
as $function$
begin
  if not coalesce(condition, false) then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end
$function$;

insert into auth.users (id, email)
values
  ('10000000-0000-4000-8000-000000000001', 'rr-sec-owner-a@example.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'rr-sec-admin-a@example.invalid'),
  ('10000000-0000-4000-8000-000000000003', 'rr-sec-owner-b@example.invalid'),
  ('10000000-0000-4000-8000-000000000004', 'rr-sec-participant@example.invalid');

insert into public.organizations (id, name, organization_type, status, slug)
values
  ('20000000-0000-4000-8000-000000000001', 'RR Security Institution A', 'campus', 'research_beta', 'rr-security-a'),
  ('20000000-0000-4000-8000-000000000002', 'RR Security Institution B', 'employer', 'research_beta', 'rr-security-b');

insert into public.organization_members (organization_id, user_id, role, status)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'admin', 'active'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'participant', 'active'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'owner', 'active');

insert into public.organization_sites (id, organization_id, name, site_type)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Institution A Site', 'campus'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Institution B Site', 'employer');

insert into public.cohorts (id, organization_id, site_id, name)
values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Institution A Cohort'),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'Institution B Cohort');

insert into public.commuter_needs
  (id, user_id, organization_id, cohort_id, origin_zone, destination_zone)
values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Zone A', 'Zone B'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'Zone C', 'Zone D');

insert into public.planned_routes
  (id, user_id, organization_id, cohort_id, origin_zone, destination_zone)
values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Zone A', 'Zone B'),
  ('60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Zone A', 'Zone E'),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'Zone C', 'Zone D');

insert into public.access_points
  (id, organization_id, name, access_point_type)
values
  ('70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Institution A Access Point', 'public_location'),
  ('70000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Institution B Access Point', 'public_location');

insert into public.match_previews
  (id, organization_id, commuter_need_id, planned_route_id, access_point_id)
values
  ('80000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001'),
  ('80000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002');

-- RR-SEC-001/002: authenticated clients have no direct mutation grants.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '10000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text,
  true
);

do $test$
begin
  begin
    update public.organization_members
    set role = 'owner'
    where organization_id = '20000000-0000-4000-8000-000000000001'
      and user_id = auth.uid();
    raise exception 'Direct membership UPDATE unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.organization_members
    where organization_id = '20000000-0000-4000-8000-000000000001'
      and role = 'owner';
    raise exception 'Direct membership DELETE unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end
$test$;

-- The guarded RPC and trigger both reject admin-to-owner escalation.
do $test$
begin
  begin
    perform public.update_organization_member(
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      'owner',
      'active'
    );
    raise exception 'Admin self-promotion unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm not in (
        'Only an owner can promote another owner',
        'Only an active owner may change owner memberships'
      ) then
        raise;
      end if;
  end;

  begin
    perform public.update_organization_member(
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'admin',
      'active'
    );
    raise exception 'Admin owner-demotion unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm not in (
        'Only an active owner may change owner memberships',
        'Organization must retain at least one active owner'
      ) then
        raise;
      end if;
  end;
end
$test$;

reset role;
select set_config('request.jwt.claims', '{}', true);

-- The database invariant applies even to privileged direct SQL.
do $test$
begin
  begin
    delete from public.organization_members
    where organization_id = '20000000-0000-4000-8000-000000000002'
      and user_id = '10000000-0000-4000-8000-000000000003';
    raise exception 'Final active owner deletion unexpectedly succeeded';
  exception
    when check_violation then
      if sqlerrm <> 'Organization must retain at least one active owner' then raise; end if;
  end;
end
$test$;

-- RR-SEC-003: valid same-tenant associations live.
insert into public.organization_member_sites (organization_id, site_id, user_id, role)
values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'participant');

insert into public.cohort_members (organization_id, cohort_id, user_id, status)
values ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'active');

insert into public.administrative_reviews (organization_id, match_preview_id, reviewer_id)
values ('20000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');

-- Every cross-institution object assignment must fail at the FK boundary.
do $test$
begin
  begin
    insert into public.cohorts (organization_id, site_id, name)
    values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'Cross-tenant cohort');
    raise exception 'Cross-tenant cohort site unexpectedly succeeded';
  exception when foreign_key_violation then null; end;

  begin
    insert into public.organization_member_sites (organization_id, site_id, user_id, role)
    values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'participant');
    raise exception 'Cross-tenant site assignment unexpectedly succeeded';
  exception when foreign_key_violation then null; end;

  begin
    insert into public.cohort_members (organization_id, cohort_id, user_id, status)
    values ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'active');
    raise exception 'Cross-tenant cohort assignment unexpectedly succeeded';
  exception when foreign_key_violation then null; end;

  begin
    insert into public.organization_invitations
      (organization_id, invited_email, role, site_id, token_hash, expires_at)
    values
      ('20000000-0000-4000-8000-000000000001', 'cross-tenant@example.invalid', 'participant', '30000000-0000-4000-8000-000000000002', 'rr-sec-cross-tenant', now() + interval '1 day');
    raise exception 'Cross-tenant invitation site unexpectedly succeeded';
  exception when foreign_key_violation then null; end;

  begin
    insert into public.organization_invitations
      (organization_id, invited_email, role, cohort_id, token_hash, expires_at)
    values
      ('20000000-0000-4000-8000-000000000001', 'cross-cohort@example.invalid', 'participant', '40000000-0000-4000-8000-000000000002', 'rr-sec-cross-cohort', now() + interval '1 day');
    raise exception 'Cross-tenant invitation cohort unexpectedly succeeded';
  exception when foreign_key_violation then null; end;

  begin
    insert into public.commuter_needs
      (user_id, organization_id, cohort_id, origin_zone, destination_zone)
    values
      ('10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'Zone A', 'Zone D');
    raise exception 'Cross-tenant commuter cohort unexpectedly succeeded';
  exception when foreign_key_violation then null; end;

  begin
    insert into public.planned_routes
      (user_id, organization_id, cohort_id, origin_zone, destination_zone)
    values
      ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'Zone A', 'Zone D');
    raise exception 'Cross-tenant planned-route cohort unexpectedly succeeded';
  exception when foreign_key_violation then null; end;

  begin
    insert into public.match_previews
      (organization_id, commuter_need_id, planned_route_id, access_point_id)
    values
      ('20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001');
    raise exception 'Cross-tenant match need unexpectedly succeeded';
  exception when foreign_key_violation then null; end;

  begin
    insert into public.match_previews
      (organization_id, commuter_need_id, planned_route_id, access_point_id)
    values
      ('20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001');
    raise exception 'Cross-tenant match route unexpectedly succeeded';
  exception when foreign_key_violation then null; end;

  begin
    insert into public.match_previews
      (organization_id, commuter_need_id, planned_route_id, access_point_id)
    values
      ('20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000002');
    raise exception 'Cross-tenant access point unexpectedly succeeded';
  exception when foreign_key_violation then null; end;

  begin
    insert into public.administrative_reviews (organization_id, match_preview_id, reviewer_id)
    values ('20000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001');
    raise exception 'Cross-tenant administrative review unexpectedly succeeded';
  exception when foreign_key_violation then null; end;
end
$test$;

select pg_temp.assert_true(
  (select count(*) = 4 from public.organization_members where organization_id in (
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002'
  )),
  'Owner and membership fixtures must remain intact after negative tests'
);

rollback;
