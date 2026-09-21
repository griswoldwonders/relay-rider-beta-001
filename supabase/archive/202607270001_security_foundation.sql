-- Relay Rider security foundation
-- Backend blueprint only. Apply through a reviewed Supabase migration before real-data use.

create extension if not exists pgcrypto;

create type public.app_role as enum ('commuter', 'route_participant', 'reviewer', 'admin');
create type public.review_status as enum (
  'draft',
  'submitted',
  'pending_verification',
  'pilot_review',
  'approved_for_demo',
  'not_activated',
  'rejected'
);

create schema if not exists private;

create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role')::public.app_role,
    'commuter'::public.app_role
  );
$$;

revoke all on function private.current_app_role() from public;
grant execute on function private.current_app_role() to authenticated;

create or replace function private.is_reviewer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_app_role() in ('reviewer'::public.app_role, 'admin'::public.app_role);
$$;

revoke all on function private.is_reviewer() from public;
grant execute on function private.is_reviewer() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  role public.app_role not null default 'commuter',
  adult_confirmed boolean not null default false,
  research_consent_at timestamptz,
  preferred_corridor text,
  privacy_preference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'No identity documents or verification artifacts. Email remains in auth.users and is not duplicated here.';

create or replace function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    coalesce(
      (new.raw_app_meta_data ->> 'role')::public.app_role,
      'commuter'::public.app_role
    )
  );
  return new;
end;
$$;

revoke all on function private.create_profile_for_new_user() from public;

create trigger create_profile_after_signup
after insert on auth.users
for each row execute function private.create_profile_for_new_user();

create table public.route_requests (
  id uuid primary key default gen_random_uuid(),
  commuter_id uuid not null references public.profiles(id) on delete cascade,
  origin_area text not null check (char_length(origin_area) between 2 and 100),
  destination_area text not null check (char_length(destination_area) between 2 and 100),
  time_window text not null check (char_length(time_window) between 2 and 100),
  days_of_week text[] not null default '{}',
  contribution_cents integer check (contribution_cents between 0 and 10000),
  anchor_point_ids text[] not null default '{}',
  max_walking_distance_meters integer check (max_walking_distance_meters between 0 and 5000),
  privacy_preference text,
  status public.review_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index route_requests_commuter_created_idx
  on public.route_requests (commuter_id, created_at desc);
create index route_requests_status_created_idx
  on public.route_requests (status, created_at desc);

create table public.driver_routes (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.profiles(id) on delete cascade,
  start_area text not null check (char_length(start_area) between 2 and 100),
  end_area text not null check (char_length(end_area) between 2 and 100),
  departure_window text not null check (char_length(departure_window) between 2 and 100),
  travel_days text[] not null default '{}',
  vehicle_class text not null check (vehicle_class in ('ev', 'phev', 'hybrid')),
  available_seats smallint not null check (available_seats between 0 and 6),
  max_detour_minutes smallint not null check (max_detour_minutes between 0 and 60),
  desired_route_value_cents integer check (desired_route_value_cents between 0 and 10000),
  anchor_point_ids text[] not null default '{}',
  verification_status public.review_status not null default 'pending_verification',
  route_status public.review_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index driver_routes_participant_created_idx
  on public.driver_routes (participant_id, created_at desc);
create index driver_routes_review_idx
  on public.driver_routes (verification_status, route_status, created_at desc);

create table public.match_previews (
  id uuid primary key default gen_random_uuid(),
  route_request_id uuid not null references public.route_requests(id) on delete cascade,
  driver_route_id uuid not null references public.driver_routes(id) on delete cascade,
  commuter_id uuid not null references public.profiles(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  total_score smallint not null check (total_score between 0 and 100),
  score_factors jsonb not null check (jsonb_typeof(score_factors) = 'object'),
  status public.review_status not null default 'pilot_review',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (route_request_id, driver_route_id)
);

create index match_previews_commuter_created_idx
  on public.match_previews (commuter_id, created_at desc);
create index match_previews_participant_created_idx
  on public.match_previews (participant_id, created_at desc);
create index match_previews_status_created_idx
  on public.match_previews (status, created_at desc);

create table public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 100),
  entity_type text not null check (char_length(entity_type) between 3 and 50),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  ip_hash text,
  user_agent_hash text,
  occurred_at timestamptz not null default now()
);

comment on table public.security_audit_events is
  'Append-only security metadata. Never include route details, tokens, documents, or exact locations.';

create index security_audit_events_actor_time_idx
  on public.security_audit_events (actor_user_id, occurred_at desc);
create index security_audit_events_action_time_idx
  on public.security_audit_events (action, occurred_at desc);

alter table public.profiles enable row level security;
alter table public.route_requests enable row level security;
alter table public.driver_routes enable row level security;
alter table public.match_previews enable row level security;
alter table public.security_audit_events enable row level security;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or (select private.is_reviewer()));

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and role = (select private.current_app_role())
);

create policy "route_requests_insert_own"
on public.route_requests for insert
to authenticated
with check (commuter_id = (select auth.uid()));

create policy "route_requests_select_own_or_review"
on public.route_requests for select
to authenticated
using (commuter_id = (select auth.uid()) or (select private.is_reviewer()));

create policy "route_requests_update_own_draft"
on public.route_requests for update
to authenticated
using (commuter_id = (select auth.uid()) and status in ('draft', 'submitted'))
with check (commuter_id = (select auth.uid()) and status in ('draft', 'submitted'));

create policy "route_requests_review"
on public.route_requests for update
to authenticated
using ((select private.is_reviewer()))
with check ((select private.is_reviewer()));

create policy "driver_routes_insert_own"
on public.driver_routes for insert
to authenticated
with check (participant_id = (select auth.uid()));

create policy "driver_routes_select_own_or_review"
on public.driver_routes for select
to authenticated
using (participant_id = (select auth.uid()) or (select private.is_reviewer()));

create policy "driver_routes_update_own_unreviewed"
on public.driver_routes for update
to authenticated
using (participant_id = (select auth.uid()) and route_status in ('draft', 'submitted'))
with check (
  participant_id = (select auth.uid())
  and route_status in ('draft', 'submitted')
  and verification_status = 'pending_verification'
);

create policy "driver_routes_review"
on public.driver_routes for update
to authenticated
using ((select private.is_reviewer()))
with check ((select private.is_reviewer()));

create policy "match_previews_select_involved_or_review"
on public.match_previews for select
to authenticated
using (
  commuter_id = (select auth.uid())
  or participant_id = (select auth.uid())
  or (select private.is_reviewer())
);

create policy "match_previews_review_only"
on public.match_previews for update
to authenticated
using ((select private.is_reviewer()))
with check ((select private.is_reviewer()));

-- No client insert/update/delete policies exist for security_audit_events.
-- Trusted server code should write events with a restricted service credential.
revoke update, delete, truncate on public.security_audit_events from authenticated, anon;

-- Match previews are created by trusted scoring/review services, not directly by clients.
revoke insert, delete on public.match_previews from authenticated, anon;

revoke all on public.profiles from anon;
revoke all on public.route_requests from anon;
revoke all on public.driver_routes from anon;
revoke all on public.match_previews from anon;
revoke all on public.security_audit_events from anon;

revoke all on public.profiles from authenticated;
revoke all on public.route_requests from authenticated;
revoke all on public.driver_routes from authenticated;
revoke all on public.match_previews from authenticated;
revoke all on public.security_audit_events from authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.route_requests to authenticated;
grant select, insert, update on public.driver_routes to authenticated;
grant select, update on public.match_previews to authenticated;
