# Pandera Validation Acceptance

Acceptance requires all of the following:

- canonical schema is named `relay_rider_commute_import_v1`
- `CommuterRecord` model and migrations are unchanged
- raw `source_payload`, row number, import SHA-256, and provenance label remain preserved
- invalid rows remain persisted with validation errors
- extra CSV columns remain accepted and retained only in the raw source payload
- existing Core Engine score semantics are unchanged
- full backend tests, Django checks, and missing-migration detection pass
