create schema if not exists relay_app;
revoke all on schema relay_app from public, anon, authenticated;
comment on schema relay_app is 'Canonical Django-owned Relay Rider application schema. Legacy Supabase/PostgREST domain tables remain in public pending controlled decommission/reconciliation.';
