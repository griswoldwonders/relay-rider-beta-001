create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  participant_type text not null default 'commuter' check (participant_type in ('commuter','planned_route_participant','administrator','reviewer')),
  accessibility_preferences jsonb not null default '{}'::jsonb,
  privacy_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text not null check (organization_type in ('employer','campus','hospital','business_district','venue','municipality','nonprofit','other')),
  status text not null default 'prospect' check (status in ('prospect','research_beta','controlled_beta','active','inactive')),
  website text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'participant' check (role in ('owner','admin','reviewer','participant','analyst')),
  status text not null default 'active' check (status in ('invited','active','suspended','removed')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  eligibility_rules jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.access_points (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  name text not null,
  address_label text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  access_point_type text not null default 'public_location' check (access_point_type in ('transit','campus_edge','library','retail','civic','hospital','charging_hub','parking','public_location','other')),
  review_status text not null default 'candidate' check (review_status in ('candidate','under_review','designated','institutionally_approved','rejected','inactive')),
  visibility_notes text,
  lighting_notes text,
  accessibility_notes text,
  route_compatibility_notes text,
  restrictions text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.commuter_needs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  cohort_id uuid references public.cohorts(id) on delete set null,
  origin_zone text not null,
  destination_zone text not null,
  travel_days smallint[] not null default '{}',
  earliest_departure time,
  latest_departure time,
  flexibility_minutes integer not null default 0 check (flexibility_minutes between 0 and 240),
  current_mode text,
  parking_difficulty smallint check (parking_difficulty between 1 and 5),
  access_point_willingness boolean not null default true,
  preferred_access_point_ids uuid[] not null default '{}',
  ev_hybrid_preference text not null default 'no_preference' check (ev_hybrid_preference in ('ev_only','ev_or_hybrid','preferred','no_preference')),
  accessibility_preferences jsonb not null default '{}'::jsonb,
  privacy_setting text not null default 'zone_only' check (privacy_setting in ('zone_only','access_point_only','limited_detail')),
  proposed_contribution numeric(10,2) check (proposed_contribution >= 0),
  status text not null default 'active' check (status in ('draft','active','paused','matched','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.planned_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  cohort_id uuid references public.cohorts(id) on delete set null,
  origin_zone text not null,
  destination_zone text not null,
  travel_days smallint[] not null default '{}',
  earliest_departure time,
  latest_departure time,
  available_capacity integer not null default 1 check (available_capacity between 1 and 8),
  maximum_detour_minutes integer not null default 10 check (maximum_detour_minutes between 0 and 120),
  preferred_access_point_ids uuid[] not null default '{}',
  vehicle_type text not null default 'unspecified' check (vehicle_type in ('ev','hybrid','plug_in_hybrid','other','unspecified')),
  vehicle_details jsonb not null default '{}'::jsonb,
  contribution_review_min numeric(10,2) check (contribution_review_min >= 0),
  contribution_review_max numeric(10,2) check (contribution_review_max >= contribution_review_min),
  privacy_setting text not null default 'zone_only' check (privacy_setting in ('zone_only','access_point_only','limited_detail')),
  verification_willingness boolean not null default false,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected','expired')),
  status text not null default 'draft' check (status in ('draft','active','paused','full','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.program_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  rules jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  effective_from timestamptz,
  effective_to timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.match_previews (
  id uuid primary key default gen_random_uuid(),
  commuter_need_id uuid not null references public.commuter_needs(id) on delete cascade,
  planned_route_id uuid not null references public.planned_routes(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  access_point_id uuid references public.access_points(id) on delete set null,
  compatibility_score numeric(5,2) check (compatibility_score between 0 and 100),
  route_fit_score numeric(5,2) check (route_fit_score between 0 and 100),
  estimated_detour_minutes integer check (estimated_detour_minutes >= 0),
  estimated_detour_miles numeric(8,2) check (estimated_detour_miles >= 0),
  time_window_fit text check (time_window_fit in ('strong','moderate','weak','none')),
  contribution_compatibility text check (contribution_compatibility in ('compatible','gap','outside_range','not_reviewed')),
  ev_hybrid_indicator text,
  explanation jsonb not null default '{}'::jsonb,
  status text not null default 'simulated' check (status in ('simulated','awaiting_admin_review','approved_for_review','declined','expired')),
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (commuter_need_id, planned_route_id)
);

create table public.administrative_reviews (
  id uuid primary key default gen_random_uuid(),
  match_preview_id uuid not null references public.match_previews(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null default 'pending' check (decision in ('pending','request_changes','approved_for_review','declined','withdrawn')),
  rationale text,
  conditions jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  consent_type text not null,
  policy_version text not null,
  granted boolean not null,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  reported_by uuid references auth.users(id) on delete set null,
  related_match_preview_id uuid references public.match_previews(id) on delete set null,
  category text not null check (category in ('safety','harassment','collision','accessibility','privacy','no_show','conduct','technical','other')),
  severity text not null default 'low' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','triaged','investigating','resolved','closed')),
  description text not null,
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.impact_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  corridor_label text not null,
  period_start date not null,
  period_end date not null,
  metric_type text not null check (metric_type in ('demand_count','planned_route_count','match_preview_count','access_point_usage','estimated_vmt_avoided','estimated_co2e_avoided','ev_hybrid_participation','parking_pressure','unmatched_demand','estimated_incentive_required','other')),
  metric_value numeric not null,
  unit text,
  methodology text,
  is_modeled boolean not null default true,
  created_at timestamptz not null default now()
);

create index commuter_needs_user_idx on public.commuter_needs(user_id);
create index commuter_needs_org_idx on public.commuter_needs(organization_id);
create index planned_routes_user_idx on public.planned_routes(user_id);
create index planned_routes_org_idx on public.planned_routes(organization_id);
create index match_previews_need_idx on public.match_previews(commuter_need_id);
create index match_previews_route_idx on public.match_previews(planned_route_id);
create index admin_reviews_match_idx on public.administrative_reviews(match_preview_id);
create index access_points_org_idx on public.access_points(organization_id);
create index incidents_org_idx on public.incidents(organization_id);
create index impact_metrics_org_period_idx on public.impact_metrics(organization_id, period_start, period_end);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger access_points_set_updated_at before update on public.access_points for each row execute function public.set_updated_at();
create trigger commuter_needs_set_updated_at before update on public.commuter_needs for each row execute function public.set_updated_at();
create trigger planned_routes_set_updated_at before update on public.planned_routes for each row execute function public.set_updated_at();

create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid() and status = 'active' and role in ('owner','admin','reviewer')
  );
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.cohorts enable row level security;
alter table public.access_points enable row level security;
alter table public.commuter_needs enable row level security;
alter table public.planned_routes enable row level security;
alter table public.program_rules enable row level security;
alter table public.match_previews enable row level security;
alter table public.administrative_reviews enable row level security;
alter table public.consent_records enable row level security;
alter table public.incidents enable row level security;
alter table public.impact_metrics enable row level security;

create policy profiles_self_all on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy organizations_member_select on public.organizations for select using (public.is_org_member(id));
create policy organizations_admin_update on public.organizations for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy organization_members_self_or_admin_select on public.organization_members for select using (user_id = auth.uid() or public.is_org_admin(organization_id));
create policy organization_members_admin_manage on public.organization_members for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy cohorts_member_select on public.cohorts for select using (public.is_org_member(organization_id));
create policy cohorts_admin_manage on public.cohorts for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy access_points_member_select on public.access_points for select using (organization_id is null or public.is_org_member(organization_id));
create policy access_points_admin_manage on public.access_points for all using (organization_id is not null and public.is_org_admin(organization_id)) with check (organization_id is not null and public.is_org_admin(organization_id));
create policy commuter_needs_owner_manage on public.commuter_needs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy commuter_needs_admin_select on public.commuter_needs for select using (organization_id is not null and public.is_org_admin(organization_id));
create policy planned_routes_owner_manage on public.planned_routes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy planned_routes_admin_select on public.planned_routes for select using (organization_id is not null and public.is_org_admin(organization_id));
create policy program_rules_member_select on public.program_rules for select using (public.is_org_member(organization_id));
create policy program_rules_admin_manage on public.program_rules for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy match_previews_participant_select on public.match_previews for select using (
  exists (select 1 from public.commuter_needs n where n.id = commuter_need_id and n.user_id = auth.uid())
  or exists (select 1 from public.planned_routes r where r.id = planned_route_id and r.user_id = auth.uid())
  or (organization_id is not null and public.is_org_admin(organization_id))
);
create policy match_previews_admin_manage on public.match_previews for all using (organization_id is not null and public.is_org_admin(organization_id)) with check (organization_id is not null and public.is_org_admin(organization_id));
create policy reviews_participant_select on public.administrative_reviews for select using (
  exists (
    select 1 from public.match_previews m
    join public.commuter_needs n on n.id = m.commuter_need_id
    join public.planned_routes r on r.id = m.planned_route_id
    where m.id = match_preview_id and (n.user_id = auth.uid() or r.user_id = auth.uid())
  ) or (organization_id is not null and public.is_org_admin(organization_id))
);
create policy reviews_admin_manage on public.administrative_reviews for all using (organization_id is not null and public.is_org_admin(organization_id)) with check (organization_id is not null and public.is_org_admin(organization_id));
create policy consent_owner_manage on public.consent_records for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy incidents_reporter_or_admin_select on public.incidents for select using (reported_by = auth.uid() or (organization_id is not null and public.is_org_admin(organization_id)));
create policy incidents_authenticated_insert on public.incidents for insert with check (reported_by = auth.uid());
create policy incidents_admin_update on public.incidents for update using (organization_id is not null and public.is_org_admin(organization_id)) with check (organization_id is not null and public.is_org_admin(organization_id));
create policy impact_metrics_member_select on public.impact_metrics for select using (organization_id is not null and public.is_org_member(organization_id));
create policy impact_metrics_admin_manage on public.impact_metrics for all using (organization_id is not null and public.is_org_admin(organization_id)) with check (organization_id is not null and public.is_org_admin(organization_id));

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;