# Supabase Migration Recovery Manifest

Branch: `migration-recovery/restore-supabase-history`
Production project: `Relay-Rider-RD` (`dzrqrqfxcihvufvyctbt`)
Production head: `20260820030336`
Production fingerprint: `b18e9cc048d5781dc126112c22517b1d`

Source of truth for recovered bodies: `supabase_migrations.schema_migrations.statements` in production. No migration was applied and no production data/schema was changed during recovery.

The SHA-256 values below are computed over `array_to_string(statements, E'\n\n')` encoded as UTF-8.

| Version | Name | SHA-256 | Bytes |
|---|---|---|---:|
| 20260721050647 | relay_rider_core_schema | 86e9e19226def08e6e1dae3cec5ba8197b5fab61a7e501df114fe0808b6d45d4 | 18243 |
| 20260721050724 | harden_public_function_access | 15c999974c9c7d0d8922ea0a6011e5d0a8d099a6a5451860dc0e185981ccb875 | 256 |
| 20260721050738 | restrict_org_helper_rpc_access | b3b907fb27c9d46228244b3de7b5990f0b9b02b0d6175703950a404d08c5c283 | 273 |
| 20260721051404 | harden_rls_helper_functions | 9a258a0081f08a2b0cb5fe46df0d500fdb15a97257719e586edde080d8a0206c | 5448 |
| 20260721051411 | restrict_default_table_privileges | ef9a393f53a2ae5b0c22646d90e85d3183d7528d119fbf01434818cc8dfe94e6 | 732 |
| 20260721051424 | tighten_sensitive_column_constraints | 3a6577b9883466038803555305925322f1d75c9891336a9155469f4a0678c893 | 966 |
| 20260721051640 | fort_knox_hardening | 4eb69b34209a572deb1cf947abb56a8b56620c1f0947cb319f2d94de4bb23e0c | 9626 |
| 20260721051647 | fort_knox_policy_role_scoping | e5f0169c4a79b2ec0f520ceebe0c1de869e0d57a53b965bc3e51817533c42fb8 | 582 |
| 20260721051829 | optimize_rls_and_foreign_key_indexes | 4a57cb9e69980ce27cd4f302c113f19c7ed0bd19a1107c7088e6b8f1eccfcd1b | 10543 |
| 20260721051856 | remove_duplicate_indexes_and_merge_select_policies | d7e603a1e474ee21583fb39754aa7e6c9a74ec254e501ad688602eb4b15605d0 | 1263 |
| 20260808022415 | add_research_beta_intake_staging | e8cd64c2a34c793aad7ec6b72ea9de647f19e03ceb3967f790073aeb99c46da6 | 11093 |
| 20260808022730 | restrict_research_beta_rpc_to_anon | 5dd6da131343a770e6aed8fa39d90adebb7fd304323bb00afea69aeb2b67f56b | 282 |
| 20260808022825 | strengthen_research_beta_consent_assertions | ca77a90e4c18729d4052f716ed4d6a17b3892427e280add367c270ace7875765 | 8026 |
| 20260808023521 | enforce_research_beta_90_day_retention | 2624beb39d54b7bab238822eb9244f3e08f8967951df790998ffd89d441978e6 | 3268 |
| 20260808025809 | expand_research_beta_governance_fields | 68ee257cb8e9f030387e5ad718d7e9f45853fdca15318a81209b687bc71a3bad | 8777 |
| 20260808052202 | saas_foundation_core | 61e942c979081c01d52a5e1897e3bed182db41577af1d0f3e84b6eed16bcad76 | 15116 |
| 20260808052302 | saas_foundation_rbac_directory | 11e905e7b6c9f7f0e343e8b266a603b41a5ff48b3ad8760330fcd164bcf442aa | 3112 |
| 20260808053031 | saas_foundation_performance_hardening | 74fcc00f564afce5d42f2f86bc532ac421598e81c6f8ff2deaf8391cef3b84f2 | 6457 |
| 20260808053122 | saas_foundation_org_onboarding_status | c137a4ce8a42534fd216c5a3cd34043bc0c283e4233038bd005c20fac6589871 | 260 |
| 20260808061151 | operational_engine_core | 2668b6755fdaaef65740a4eec4865dba8911170f9b564ef1343452b1bc529eaf | 14842 |
| 20260808061242 | operational_engine_membership | dab2c9816b730a4d4218ae8cca301247f1f5c785e6e0facf548d4ca2a4faeefd | 8396 |
| 20260808061410 | operational_engine_ingestion | ac3b735fb97209071cc5d5e436a7d77ba0e692e430099668c6189d66a664a2d2 | 17401 |
| 20260808061524 | operational_engine_intelligence | f229a7a6c7a2a8384eedee56fb8794e8eeee100caac08c2d73530bb6a7a1da53 | 13643 |
| 20260808062308 | operational_engine_hardening | 3761772f27eb11befefed182085beb5d20b08062b2ec0b43530e19b0df4ea391 | 17425 |
| 20260811202929 | pcc_evidence_engine_v2 | cc4a0c5b8e7d79de51a5b782f70e9d1af46925f5daddbb2124cbcefef17d3fca | 13787 |
| 20260817023513 | rule2202_persistence_20260812041000 | cb592ef2ea8201e985adbb3f6d2d923c3133f2aced9486f0d96b14c6e4e3fab1 | 10317 |
| 20260817023652 | authenticated_runtime_table_grants_20260817024500 | 3c7056b36933f2d0eab68917a533846a99b504db703d18464172f555cc82b63c | 1594 |
| 20260817023850 | public_deployment_fingerprint_20260817025000 | e3c887ae9bef0551569a3d0a0dd594c3d0de4c3502309cc303d1d4bd9621bb0b | 811 |
| 20260817024507 | harden_deployment_fingerprint_20260817030000 | b73af3024a3fcfd405ce5b67f75da579bc03092d59a0c810d1435a825bbb5c95 | 2656 |
| 20260817030119 | participant_client_contract_v1_20260817032000 | 3a272033efd8c9a6958973591b221fbd29fd185ea181773e4250a5167871a9c5 | 12691 |
| 20260820030336 | enable_rls_on_private_audit_events | 7f3150ac1800043ff1e02345c1079cafa40f9306fba2dfd8151925443fd1ea2c | 958 |

## Verification findings

1. Production contains 31 applied migration rows and all 31 have retained SQL statement bodies.
2. The production migration head is `20260820030336`, matching `public.relay_deployment_fingerprint`.
3. GitHub `main` currently has only two active files in `supabase/migrations`: `202607270001_security_foundation.sql` and pending `202609020001_rule2202_calculation_functions.sql`.
4. `202607270001_security_foundation.sql` is not present in production migration history and defines overlapping objects such as `public.profiles` and `public.match_previews`; it must not be treated as part of the recovered production lineage without a separate architectural decision.
5. `202609020001_rule2202_calculation_functions.sql` is pending code and is not deployed in production.
6. No production DDL, migration repair, or data mutation was performed during this recovery pass.
