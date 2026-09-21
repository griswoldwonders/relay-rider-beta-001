-- UNAPPLIED. Do not run against the linked production project without explicit
-- production-deploy approval. This file is intentionally outside
-- supabase/migrations so `supabase db push` cannot apply it by accident.
--
-- Adds a tenant-scoped unique index so Relay Rider projection retries cannot
-- insert duplicate evidence rows for the same canonical record + projector
-- version. The Django projector already upserts by relay_projection_key.

create unique index if not exists evidence_commute_relay_projection_key_uidx
  on public.evidence_commute_observations (
    organization_id,
    (original_payload->>'relay_projection_key')
  )
  where original_payload->>'source_system' in ('relay_rider', 'relay_rider_projection')
    and coalesce(original_payload->>'relay_projection_key', '') <> '';
