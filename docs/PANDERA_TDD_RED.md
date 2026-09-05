# Pandera TDD Red Gate

The first implementation gate is the schema-contract test in `backend/relay/test_vertical_slice.py`.

Before production code is added, the branch must demonstrate that the targeted test fails because `relay.services.ingestion` does not yet expose `COMMUTE_IMPORT_SCHEMA`.
