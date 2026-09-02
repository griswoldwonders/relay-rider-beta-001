# ============================================================================
# Rule 2202 — cross-tenant access denial integration test
# ============================================================================
# Status: SPEC / NOT YET RUN AGAINST LIVE DB
# Blocker: requires a Supabase project URL + anon key with the
#          202609020002_rule2202_domain_model migration applied.
#
# This document describes the integration test that proves the RLS policies
# in 202609020002_rule2202_domain_model.sql prevent a user affiliated with
# institution A from reading worksite data belonging to institution B.
#
# It is the gating check called out in the Rule 2202 build order before any
# real partner data is imported. The `assert_tenant_access()` helper and the
# RLS SELECT policies both encode the same tenant-boundary check; this test
# verifies they actually catch a cross-tenant read attempt at the database
# level (not just in application logic).
# ============================================================================

# ---------------------------------------------------------------------------
# 1. Preconditions
# ---------------------------------------------------------------------------

# - Supabase project with RLS enabled
# - Migrations applied in order:
#     202607270001_security_foundation.sql
#     202609020001_rule2202_calculation_functions.sql
#     202609020002_rule2202_domain_model.sql
# - At least two institutions created in public.institutions
# - At least two user accounts (auth.users) with JWT app_metadata.role set
# - At least one membership per user in public.institution_memberships
#   linking each user to exactly one institution
# - At least one worksite per institution in public.rule2202_worksites
# - The test user's JWT must carry the correct app_metadata.role so that
#   private.current_app_role() and private.is_reviewer() return the expected
#   values. For the cross-tenant denial test, the user should be a 'commuter'
#   or 'institution_admin' — NOT a reviewer — so the is_reviewer() bypass is
#   not available.

# ---------------------------------------------------------------------------
# 2. Test setup (run once in SQL Editor)
# ---------------------------------------------------------------------------

# The SQL below is a reference setup script. Adjust UUIDs, institution names,
# and worksite details to match your Supabase project. DO NOT paste real
# credentials into this file — run it from your Supabase SQL Editor with your
# own values.

# -- Create two test institutions
# insert into public.institutions (id, name, status, created_at, updated_at)
# values
#   ('00000000-0000-0000-0000-000000000001', 'Test Institution A', 'active', now(), now()),
#   ('00000000-0000-0000-0000-000000000002', 'Test Institution B', 'active', now(), now());

# -- Create test user A (commuter role, institution A)
# -- The raw_app_meta_data must include role so create_profile_for_new_user works.
# insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at, ...)
# values
#   ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
#    'test-a@example.com',
#    '{"role": "commuter"}'::jsonb,
#    now(), now(),
#    ...);

# -- Create test user B (commuter role, institution B)
# insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at, ...)
# values
#   ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
#    'test-b@example.com',
#    '{"role": "commuter"}'::jsonb,
#    now(), now(),
#    ...);

# -- Link user A to institution A only
# insert into public.institution_memberships (user_id, institution_id, role, created_at)
# values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'commuter', now());

# -- Link user B to institution B only
# insert into public.institution_memberships (user_id, institution_id, role, created_at)
# values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000002', 'commuter', now());

# -- Create a worksite for institution A
# insert into public.rule2202_worksites (
#   id, institution_id, worksite_name, six_digit_worksite_id, employer_name,
#   performance_zone, reporting_method, business_classification,
#   review_state, filing_status, created_at, updated_at
# ) values (
#   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
#   '00000000-0000-0000-0000-000000000001',
#   'Worksite A-1',
#   '111111',
#   'Employer A',
#   2,
#   'survey_avr',
#   'commercial',
#   'draft',
#   'draft',
#   now(),
#   now()
# );

# -- Create a worksite for institution B
# insert into public.rule2202_worksites (
#   id, institution_id, worksite_name, six_digit_worksite_id, employer_name,
#   performance_zone, reporting_method, business_classification,
#   review_state, filing_status, created_at, updated_at
# ) values (
#   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0001',
#   '00000000-0000-0000-0000-000000000002',
#   'Worksite B-1',
#   '222222',
#   'Employer B',
#   1,
#   'survey_avr',
#   'commercial',
#   'draft',
#   'draft',
#   now(),
#   now()
# );

# ---------------------------------------------------------------------------
# 3. Test cases
# ---------------------------------------------------------------------------

# Each test case is a SQL query run as a specific user via the Supabase client
# (or the SQL Editor with SET LOCAL role / SET LOCAL jwt claims if your tooling
# supports it). The canonical way to test RLS is to run the query through a
# Postgres function that sets the JWT claims for auth.uid() and
# auth.jwt(), since the SQL Editor runs as a superuser and bypasses RLS.

# ---------------------------------------------------------------------------
# 3a. User A can read their own institution's worksite
# ---------------------------------------------------------------------------

# Given: JWT for user A (aaaaaaaa-aaaa-...) with role 'commuter',
#        institution_affiliation = 00000000-0000-...-0001
# When:  select * from public.rule2202_worksites where id = 'aaaaaaaa-...-0001'
# Then:  exactly one row is returned (Worksite A-1)

# ---------------------------------------------------------------------------
# 3b. User A CANNOT read institution B's worksite
# ---------------------------------------------------------------------------

# Given: JWT for user A (aaaaaaaa-aaaa-...) with role 'commuter',
#        institution_affiliation = 00000000-0000-...-0001
# When:  select * from public.rule2202_worksites where id = 'bbbbbbbb-...-0001'
# Then:  zero rows are returned (RLS policy denies the read)

# This is the CORE gating assertion. A commuter affiliated with institution A
# must get zero rows for institution B's worksite, not an error and not the
# data. The RLS policy "rule2202_worksites_select_institution" should evaluate
# to FALSE because:
#   - user A's institution_memberships contain institution A only
#   - user A is not a reviewer (is_reviewer() = false)
#   - therefore institution_id in (...) evaluates to FALSE
#   - therefore the SELECT policy denies access

# ---------------------------------------------------------------------------
# 3c. User A can see the existence of their own worksites list
# ---------------------------------------------------------------------------

# Given: JWT for user A
# When:  select id, worksite_name, six_digit_worksite_id from
#          public.rule2202_worksites
#          where institution_id =
#            (select institution_id from public.institution_memberships
#             where user_id = auth.uid())
# Then:  exactly one row (Worksite A-1), never Worksite B-1

# ---------------------------------------------------------------------------
# 3d. User A cannot insert a worksite for institution B
# ---------------------------------------------------------------------------

# Given: JWT for user A with role 'commuter'
# When:  insert into public.rule2202_worksites (...)
#          values (..., institution_id = '00000000-0000-...-0002', ...)
# Then:  the insert is rejected by the
#          "rule2202_worksites_insert_institution" policy, which requires
#          institution_id in (select institution_id from
#          public.institution_memberships where user_id = auth.uid()
#          and role in ('admin', 'reviewer'))

# ---------------------------------------------------------------------------
# 3e. A reviewer can read across institutions (intended bypass)
# ---------------------------------------------------------------------------

# Given: JWT for a reviewer user with memberships in BOTH institution A and
#        institution B (or a reviewer role that bypasses the tenant filter via
#        the is_reviewer() OR clause)
# When:  select id, worksite_name from public.rule2202_worksites
# Then:  rows from BOTH institution A and institution B are returned

# This verifies the reviewer bypass path works correctly. It's an intentional
# design property, not a bug: reviewers (and platform_admins) need cross-tenant
# visibility to do their job. The gating check for importers is specifically
# that a NON-reviewer commuter cannot leak another institution's data.

# ---------------------------------------------------------------------------
# 3f. assert_tenant_access() raises for cross-tenant call
# ---------------------------------------------------------------------------

# Given: JWT for user A (commuter, institution A only)
# When:  select public.assert_tenant_access('00000000-0000-0000-0000-000000000002')
# Then:  the function raises an exception:
#          'cross-tenant access denied for institution 00000000-0000-...-0002'

# This tests the explicit denial helper used by server-side code that needs to
# assert tenant access before operating on a worksite. It is the programmatic
# equivalent of test case 3b, exposed as a callable function.

# ---------------------------------------------------------------------------
# 4. How to run these tests
# ---------------------------------------------------------------------------

# Option A — Vitest + a seeded test Supabase project (preferred for CI):
#   1. Create a dedicated Supabase project for integration tests.
#   2. Apply the three migrations above.
#   3. Run the setup SQL from section 2.
#   4. Write a Vitest test that:
#        - creates two Supabase clients, each configured with a different
#          user's JWT (or uses the service role to impersonate each user via
#          SET LOCAL for auth.uid/auth.jwt in a wrapped function)
#        - calls listWorksites() and getWorksite() and asserts tenant isolation
#   5. Assert:
#        - user A's client returns only institution A worksites
#        - user A's client returns 0 rows for institution B worksite id
#        - user B's client returns only institution B worksites
#        - reviewer client returns both institutions' worksites

# Option B — SQL Editor hand-run checks (for manual verification before CI):
#   1. Open Supabase SQL Editor.
#   2. Run the setup SQL from section 2.
#   3. For each test case, write a wrapper function that sets the JWT claims
#      for the target user and runs the query, then asserts the expected row
#      count. Example skeleton:

#   create or replace function test_cross_tenant_read(
#     target_user_id uuid,
#     target_institution_id uuid,
#     target_worksite_id uuid
#   ) returns table (
#     allowed boolean,
#     row_count int,
#     note text
#   )
#   language plpgsql
#   as $$
#   declare
#     v_count int;
#   begin
#     -- Set the JWT claims for the target user so auth.uid() returns
#     -- the right identity and RLS evaluates correctly.
#     -- Note: this requires your Supabase setup to support jwt manipulation
#     -- in a security-definer function, or you run this through a trusted
#     -- test harness that sets claims before calling.
#     perform public.assert_tenant_access(target_institution_id);
#     select count(*) into v_count
#     from public.rule2202_worksites
#     where id = target_worksite_id;
#     return query select true, v_count, 'read succeeded'::text;
#   exception
#     when others then
#     return query select false, 0, sqlerrm::text;
#   end;
#   $$;

#   -- Then: select * from test_cross_tenant_read(
#     'aaaaaaaa-aaaa-...',
#     '00000000-0000-...-0002',   -- institution B (user A is NOT a member)
#     'bbbbbbbb-bbbb-...-0001'    -- worksite B-1
#   );
#   -- Expected: allowed = false, row_count = 0, note contains
#   --            'cross-tenant access denied for institution ...'

# Option C — supabase-js integration test with two anon sessions:
#   1. Sign in as user A and user B via auth.signInWithPassword.
#   2. Use each session's supabase client to call listWorksites() and
#      getWorksite().
#   3. Assert each sees only their own institution's data.
#   This is the most realistic test because it exercises the actual RLS path
#   the production app takes. The downside is that it requires two real user
#   accounts with memberships set up.

# ---------------------------------------------------------------------------
# 5. Acceptance criteria (must all pass before real partner data import)
# ---------------------------------------------------------------------------

# - [ ] User A (commuter, institution A) reads exactly their own worksite(s),
#       never institution B's.
# - [ ] User A querying institution B's worksite id returns 0 rows, not an
#       error and not the data.
# - [ ] User B (commuter, institution B) reads exactly their own worksite(s).
# - [ ] User A cannot insert/update/delete institution B's worksite.
# - [ ] Reviewer user sees both institutions' worksites (intended bypass).
# - [ ] assert_tenant_access('institution_B_uuid') raises when called by user A.
# - [ ] assert_tenant_access('institution_A_uuid') succeeds when called by user A.
# - [ ] A user with NO institution_memberships row gets 0 rows from any
#       rule2202_worksites select (totally unaffiliated commuter).

# ---------------------------------------------------------------------------
# 6. Relationship to the build order gate
# ---------------------------------------------------------------------------

# The build order says: "No real partner data gets imported until step 1 is
# done and its cross-tenant tests pass." Step 1 = institution tenancy + RBAC.
#
# This spec covers the cross-tenant denial tests. Once all acceptance criteria
# in section 5 pass against a live (or seeded test) Supabase project, the gate
# is satisfied and real partner data import is permitted — subject to the
# additional constraint that importer credentials use the lowest-privilege role
# that the data load requires, and that the import is itself audited.
