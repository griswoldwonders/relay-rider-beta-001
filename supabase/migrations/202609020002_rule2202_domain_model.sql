-- ============================================================================
-- Migration: Rule 2202 Domain Model
-- Worksites, commuter research, and methodology registry with institution tenancy
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

create type public.rule2202_business_classification as enum (
  'other',
  'commercial',
  'commercial_with_mfg',
  'mfg_unclassified',
  'mfg_1_250_employees',
  'mfg_251_500_employees',
  'mfg_501_1000_employees',
  'mfg_1001_3000_employees',
  'mfg_over_3000_employees',
  'education',
  'healthcare',
  'public_sector',
  'nonprofit'
);

create type public.rule2202_review_state as enum (
  'draft',
  'data_incomplete',
  'validation_failed',
  'ready_for_review',
  'approved_for_export',
  'exported',
  'filed_externally',
  'superseded'
);

create type public.rule2202_filing_status as enum (
  'draft',
  'incomplete',
  'ready_for_review',
  'submitted',
  'returned',
  'complete'
);

create type public.rule2202_measurement_method as enum (
  'survey_avr',
  'zip_code',
  'default_factors',
  'not_determined'
);

-- ----------------------------------------------------------------------------
-- Rule 2202 Worksites
-- ----------------------------------------------------------------------------

create table public.rule2202_worksites (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  worksite_name text not null check (char_length(worksite_name) between 1 and 200),
  six_digit_worksite_id text check (six_digit_worksite_id ~ '^\d{6}$' or six_digit_worksite_id is null),
  employer_name text not null check (char_length(employer_name) between 1 and 200),
  facility_description text,
  street_address text,
  city text,
  state text default 'CA',
  zip_code text,
  performance_zone smallint check (performance_zone between 1 and 3),
  performance_zone_source text,
  performance_zone_verified_at timestamptz,
  reporting_method public.rule2202_measurement_method not null default 'not_determined',
  reporting_period_start date,
  reporting_period_end date,
  -- Six monthly employee counts (Rule 2202 requires monthly data)
  employee_count_month_1 int,
  employee_count_month_2 int,
  employee_count_month_3 int,
  employee_count_month_4 int,
  employee_count_month_5 int,
  employee_count_month_6 int,
  employee_count_notes text,
  -- Notification and due dates
  aqr_notification_date date,
  aqr_survey_due_date date,
  aqr_survey_complete_date date,
  aqr_submittal_due_date date,
  aqr_submittal_actual_date date,
  permanent_filing_due_date date,
  filing_fee_version text,
  -- Classification
  business_classification public.rule2202_business_classification not null default 'other',
  -- ECRP
  ecrp_candidate_zone smallint check (ecrp_candidate_zone between 1 and 3),
  ecrp_candidate_ETC text,
  ecrp_candidate_ETC_verified_at timestamptz,
  ecrp_candidate_notes text,
  -- Source documents
  source_document_type text,
  source_document_reference text,
  source_document_date date,
  source_url text,
  source_notes text,
  -- Review state
  review_state public.rule2202_review_state not null default 'draft',
  data_completeness_notes text,
  validation_errors jsonb default '[]'::jsonb check (jsonb_typeof(validation_errors) = 'array'),
  review_started_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_decision text,
  review_decision_at timestamptz,
  -- Filing completeness
  filing_status public.rule2202_filing_status not null default 'draft',
  fee_verified boolean default false,
  fee_expected numeric,
  fee_submitted numeric,
  fee_verification_source text,
  fee_verified_by uuid references public.profiles(id) on delete set null,
  fee_verified_at timestamptz,
  required_forms jsonb default '[]'::jsonb check (jsonb_typeof(required_forms) = 'array'),
  completeness_notes text,
  -- Audit fields
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  unique (institution_id, six_digit_worksite_id),
  unique (institution_id, worksite_name, reporting_period_start)
);

comment on table public.rule2202_worksites is
  'Rule 2202 worksite records with six monthly employee counts, notification/due dates, business classification, ECRP candidate zone, source documents, review state, and filing completeness. All records are institution-scoped.';

create index rule2202_worksites_institution_idx
  on public.rule2202_worksites (institution_id, created_at desc);

create index rule2202_worksites_review_state_idx
  on public.rule2202_worksites (review_state, created_at desc);

create index rule2202_worksites_filing_status_idx
  on public.rule2202_worksites (filing_status, created_at desc);

create index rule2202_worksites_aqr_due_idx
  on public.rule2202_worksites (aqr_survey_due_date, aqr_submittal_due_date)
  where aqr_survey_due_date is not null;

-- ----------------------------------------------------------------------------
-- Commuter Research Records
-- ----------------------------------------------------------------------------

create type public.commuter_research_mode as enum (
  'drive_alone',
  'carpool',
  'vanpool',
  'shared_motorcycle',
  'transit',
  'bus_pool',
  'bicycle',
  'walk',
  'telecommute',
  'cww_day_off',
  'zev',
  'non_commuting',
  'not_specified'
);

create type public.commuter_research_vehicle_class as enum (
  'bev',
  'phev',
  'hybrid',
  'gasoline_diesel',
  'no_vehicle',
  'prefer_not_to_say'
);

create table public.commuter_research_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  worksite_id uuid not null references public.rule2202_worksites(id) on delete cascade,
  -- Pseudonymous employee ID (not name, email, or exact address)
  pseudonymous_employee_id text not null check (char_length(pseudonymous_employee_id) between 1 and 64),
  -- Approximate geography (zone-based, not exact)
  approximate_origin_zone text,
  approximate_destination_zone text,
  -- Arrival/departure windows
  arrival_window_start time,
  arrival_window_end time,
  departure_window_start time,
  departure_window_end time,
  -- Commute mode
  commute_mode public.commuter_research_mode not null default 'not_specified',
  commute_mode_source text,
  -- Occupancy (for carpool/vanpool/motorcycle weighting)
  vehicle_occupancy int check (vehicle_occupancy is null or (vehicle_occupancy between 1 and 15)),
  -- Telecommute frequency (days per week, 0-5)
  telecommute_days_per_week int check (telecommute_days_per_week is null or (telecommute_days_per_week between 0 and 5)),
  -- One-way distance (miles, with source)
  one_way_distance_miles numeric check (one_way_distance_miles is null or (one_way_distance_miles >= 0)),
  distance_source text check (distance_source in ('self_reported', 'zip_to_zip', 'route_estimated', 'gps_derived', 'not_specified')),
  -- EV / hybrid participation
  vehicle_class public.commuter_research_vehicle_class default 'prefer_not_to_say',
  vehicle_make text,
  vehicle_model text,
  vehicle_year text,
  ev_hybrid_participation boolean default false,
  -- Route interest signals
  interested_in_ev_route boolean default false,
  interested_in_carpool_route boolean default false,
  interested_in_transit_option boolean default false,
  route_interest_notes text,
  -- Survey metadata
  survey_period_start date,
  survey_period_end date,
  response_received_at timestamptz,
  source_template_version text,
  source_import_batch_id uuid,
  -- Status
  status public.review_status not null default 'submitted',
  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  unique (worksite_id, pseudonymous_employee_id, survey_period_start)
);

comment on table public.commuter_research_records is
  'Pseudonymous commuter research records for Rule 2202 AVR/VMT calculation inputs. Contains no names, email addresses, exact home addresses, raw GPS traces, or unhashed payroll identifiers. Zone-based geography only.';

create index commuter_research_worksite_idx
  on public.commuter_research_records (worksite_id, survey_period_start);

create index commuter_research_mode_idx
  on public.commuter_research_records (commute_mode, created_at desc);

create index commuter_research_ev_participation_idx
  on public.commuter_research_records (ev_hybrid_participation, vehicle_class)
  where ev_hybrid_participation = true;

create index commuter_research_route_interest_idx
  on public.commuter_research_records (interested_in_ev_route, interested_in_carpool_route, created_at desc);

-- ----------------------------------------------------------------------------
-- Versioned Methodology Registry
-- ----------------------------------------------------------------------------

create table public.rule2202_methodologies (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  methodology_name text not null check (char_length(methodology_name) between 1 and 100),
  methodology_type text not null check (char_length(methodology_type) between 1 and 50),
  -- What is being calculated
  metric_type text not null check (char_length(metric_type) between 1 and 50),
  -- Pollutants this methodology applies to
  applicable_pollutants text[] not null default '{}',
  -- Factor year used
  factor_year int,
  -- Source
  source_name text,
  source_url text,
  source_publication_date date,
  -- Formula representation (human-readable, for audit trail)
  formula_text text,
  -- Units of the result
  result_units text not null default 'lbs/year',
  -- Assumptions documented
  assumptions text[],
  -- Whether this methodology is active
  is_active boolean not null default true,
  -- Versioning
  version text not null default '1.0.0',
  supersedes_methodology_id uuid references public.rule2202_methodologies(id) on delete set null,
  -- Audit
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  unique (institution_id, methodology_name, version)
);

comment on table public.rule2202_methodologies is
  'Versioned registry of AVR, VMT, ERT, VTEC, pollutant, factor year, source, formula, units, and assumption records. Each methodology is institution-scoped and versioned. Calculations reference methodology_id for full provenance.';

create index rule2202_methodologies_institution_idx
  on public.rule2202_methodologies (institution_id, metric_type, is_active desc, created_at desc);

create index rule2202_methodologies_active_idx
  on public.rule2202_methodologies (metric_type, factor_year, is_active)
  where is_active = true;

-- ----------------------------------------------------------------------------
-- Methodology Calculation Results (audit trail for each calculation run)
-- ----------------------------------------------------------------------------

create table public.rule2202_calculation_results (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  methodology_id uuid not null references public.rule2202_methodologies(id) on delete cascade,
  worksite_id uuid not null references public.rule2202_worksites(id) on delete cascade,
  calculation_type text not null check (char_length(calculation_type) between 1 and 50),
  -- Inputs snapshot
  input_parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(input_parameters) = 'object'),
  -- Output
  result_value numeric,
  result_unit text,
  -- When
  calculation_timestamp timestamptz not null default now(),
  calculated_by uuid references public.profiles(id) on delete set null,
  -- Notes / warnings
  warnings text[],
  notes text,
  -- Audit
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.rule2202_calculation_results is
  'Immutable audit trail of each Rule 2202 calculation run. Stores methodology version, input parameters, result, and timestamp. Never updated after creation.';

create index rule2202_calc_results_worksite_idx
  on public.rule2202_calculation_results (worksite_id, calculation_type, calculation_timestamp desc);

create index rule2202_calc_results_methodology_idx
  on public.rule2202_calculation_results (methodology_id, calculation_timestamp desc);

-- ----------------------------------------------------------------------------
-- Row-level security
-- ----------------------------------------------------------------------------

alter table public.rule2202_worksites enable row level security;
alter table public.commuter_research_records enable row level security;
alter table public.rule2202_methodologies enable row level security;
alter table public.rule2202_calculation_results enable row level security;

-- Worksite policies (institution-scoped + reviewer access)
create policy "rule2202_worksites_select_institution"
  on public.rule2202_worksites for select
  to authenticated
  using (
    institution_id in (
      select institution_id from public.institution_memberships
      where user_id = auth.uid()
    )
    or (select private.is_reviewer())
  );

create policy "rule2202_worksites_insert_institution"
  on public.rule2202_worksites for insert
  to authenticated
  with check (
    institution_id in (
      select institution_id from public.institution_memberships
      where user_id = auth.uid()
      and role in ('admin'::public.app_role, 'reviewer'::public.app_role)
    )
  );

create policy "rule2202_worksites_update_institution"
  on public.rule2202_worksites for update
  to authenticated
  using (
    institution_id in (
      select institution_id from public.institution_memberships
      where user_id = auth.uid()
      and role in ('admin'::public.app_role, 'reviewer'::public.app_role)
    )
  );

create policy "rule2202_worksites_delete_institution"
  on public.rule2202_worksites for delete
  to authenticated
  using (
    institution_id in (
      select institution_id from public.institution_memberships
      where user_id = auth.uid()
      and role = 'admin'::public.app_role
    )
  );

-- Commuter research policies (institution-scoped + reviewer access)
create policy "commuter_research_select_institution"
  on public.commuter_research_records for select
  to authenticated
  using (
    institution_id in (
      select institution_id from public.institution_memberships
      where user_id = auth.uid()
    )
    or (select private.is_reviewer())
  );

create policy "commuter_research_insert_institution"
  on public.commuter_research_records for insert
  to authenticated
  with check (
    institution_id in (
      select institution_id from public.institution_memberships
      where user_id = auth.uid()
      and role in ('admin'::public.app_role, 'reviewer'::public.app_role)
    )
  );

create policy "commuter_research_update_institution"
  on public.commuter_research_records for update
  to authenticated
  using (
    institution_id in (
      select institution_id from public.institution_memberships
      where user_id = auth.uid()
      and role in ('admin'::public.app_role, 'reviewer'::public.app_role)
    )
  );

create policy "commuter_research_delete_institution"
  on public.commuter_research_records for delete
  to authenticated
  using (
    institution_id in (
      select institution_id from public.institution_memberships
      where user_id = auth.uid()
      and role = 'admin'::public.app_role
    )
  );

-- Methodology policies (institution-scoped + reviewer access)
create policy "rule2202_methodologies_select_institution"
  on public.rule2202_methodologies for select
  to authenticated
  using (
    institution_id in (
      select institution_id from public.institution_memberships
      where user_id = auth.uid()
    )
    or (select private.is_reviewer())
  );

create policy "rule2202_methodologies_insert_institution"
  on public.rule2202_methodologies for insert
  to authenticated
  with check (
    institution_id in (
      select institution_id from public.institution_memberships
      where user_id = auth.uid()
      and role in ('admin'::public.app_role, 'reviewer'::public.app_role)
    )
  );

create policy "rule2202_methodologies_update_institution"
  on public.rule2202_methodologies for update
  to authenticated
  using (
    institution_id in (
      select institution_id from public.institution_memberships
      where user_id = auth.uid()
      and role in ('admin'::public.app_role, 'reviewer'::public.app_role)
    )
  );

create policy "rule2202_methodologies_delete_institution"
  on public.rule2202_methodologies for delete
  to authenticated
  using (
    institution_id in (
      select institution_id from public.institution_memberships
      where user_id = auth.uid()
      and role = 'admin'::public.app_role
    )
  );

-- Calculation results policies (read-only for most, write via trusted service)
create policy "rule2202_calc_results_select_institution"
  on public.rule2202_calculation_results for select
  to authenticated
  using (
    institution_id in (
      select institution_id from public.institution_memberships
      where user_id = auth.uid()
    )
    or (select private.is_reviewer())
  );

-- Calculation results are written by trusted server-side code via service role
revoke insert, update, delete on public.rule2202_calculation_results from authenticated, anon;

-- Cross-tenant access denial audit helper
create or replace function public.assert_tenant_access(
  target_institution_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.institution_memberships
    where user_id = auth.uid()
    and institution_id = target_institution_id
  ) and not private.is_reviewer() then
    raise exception 'cross-tenant access denied for institution %', target_institution_id;
  end if;
end;
$$;

revoke all on function public.assert_tenant_access from public;
grant execute on function public.assert_tenant_access to authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: updated_at
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rule2202_worksites_updated_at
  before update on public.rule2202_worksites
  for each row execute function public.set_updated_at();

create trigger commuter_research_records_updated_at
  before update on public.commuter_research_records
  for each row execute function public.set_updated_at();

create trigger rule2202_methodologies_updated_at
  before update on public.rule2202_methodologies
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Type grants
-- ----------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select on public.rule2202_worksites to authenticated;
grant select on public.commuter_research_records to authenticated;
grant select on public.rule2202_methodologies to authenticated;
grant select on public.rule2202_calculation_results to authenticated;

grant insert, update on public.rule2202_worksites to authenticated;
grant insert, update on public.commuter_research_records to authenticated;
grant insert, update on public.rule2202_methodologies to authenticated;
